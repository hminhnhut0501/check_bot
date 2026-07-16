import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserFromBearerToken } from '@/lib/supabase/auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createTrackingCode, normalizeIdentifier } from '@/lib/reports/normalize';

const requiredTypes = new Set(['person', 'phone', 'bank_account', 'telegram_user', 'telegram_group', 'website', 'domain', 'email', 'crypto_wallet', 'social_account', 'company', 'unknown']);

function clientKey(request: Request, userId?: string) {
  return `report:${userId ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'anonymous'}`;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 100_000) return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  const internalSecret = request.headers.get('x-internal-secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const isInternal = Boolean(internalSecret && internalSecret === process.env.INTERNAL_API_SECRET);
  const user = isInternal ? null : await getUserFromBearerToken(request);
  const limit = enforceRateLimit(clientKey(request, user?.id));
  if (!limit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const targetType = String(body.target_type ?? '').trim();
  const targetName = String(body.target_name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const incidentType = String(body.incident_type ?? '').trim();
  if (!requiredTypes.has(targetType) || !targetName || !description || !incidentType) {
    return NextResponse.json({ error: 'target_type, target_name, incident_type and description are required' }, { status: 422 });
  }

  const idempotencyKey = String(body.idempotency_key ?? request.headers.get('x-idempotency-key') ?? '').trim() || null;
  const supabase = createServerSupabaseClient();
  if (idempotencyKey) {
    const existing = await supabase.from('scam_reports').select('id, tracking_code, status').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing.data) return NextResponse.json({ report: existing.data, duplicate: true }, { status: 200 });
  }

  const { data, error } = await supabase.from('scam_reports').insert({
    tracking_code: createTrackingCode(),
    idempotency_key: idempotencyKey,
    reporter_user_id: user?.id ?? null,
    reporter_chat_id: typeof body.reporter_chat_id === 'string' ? body.reporter_chat_id : null,
    source_type: isInternal || body.source_type === 'telegram' ? 'telegram' : 'web',
    source_chat_id: typeof body.source_chat_id === 'string' ? body.source_chat_id : null,
    source_message_id: typeof body.source_message_id === 'string' ? body.source_message_id : null,
    target_name: targetName,
    target_type: targetType,
    incident_type: incidentType,
    incident_date: typeof body.incident_date === 'string' ? body.incident_date : null,
    amount: typeof body.amount === 'number' ? body.amount : null,
    currency: typeof body.currency === 'string' ? body.currency : null,
    description,
    evidence_text: typeof body.evidence_text === 'string' ? body.evidence_text : null,
    evidence_payload: typeof body.evidence_payload === 'object' && body.evidence_payload ? body.evidence_payload : {},
  }).select('id, tracking_code, status, created_at').single();

  if (error) return NextResponse.json({ error: 'Could not create report', detail: error.message }, { status: 500 });
  return NextResponse.json({ report: data, normalized_target: normalizeIdentifier(targetName) }, { status: 201 });
}
