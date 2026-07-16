import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 50_000) return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
  const key = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'anonymous';
  if (!enforceRateLimit(`dispute:${key}`, 3).allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const statement = String(body.statement ?? '').trim();
  if (statement.length < 20) return NextResponse.json({ error: 'Statement must contain at least 20 characters' }, { status: 422 });
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('disputes').insert({
    tracking_code: typeof body.tracking_code === 'string' ? body.tracking_code.trim() : null,
    entity_id: typeof body.entity_id === 'string' ? body.entity_id : null,
    requester_name: typeof body.requester_name === 'string' ? body.requester_name.trim() : null,
    requester_email: typeof body.requester_email === 'string' ? body.requester_email.trim() : null,
    statement,
    evidence_payload: typeof body.evidence_payload === 'object' && body.evidence_payload ? body.evidence_payload : {},
  }).select('id, status, created_at').single();
  if (error) return NextResponse.json({ error: 'Could not create dispute' }, { status: 500 });
  return NextResponse.json({ dispute: data }, { status: 201 });
}
