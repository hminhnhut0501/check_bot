import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { renderBroadcast } from '@/lib/broadcasts/template';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  let query = createServerSupabaseClient().from('scam_broadcasts').select('*, scam_entities(display_name, entity_type, risk_level, risk_score)').order('created_at', { ascending: false }).limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ broadcasts: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  const supabase = createServerSupabaseClient();
  const { data: entity } = await supabase.from('scam_entities').select('*').eq('id', body.entity_id).eq('status', 'active').single();
  if (!entity) return NextResponse.json({ error: 'Active entity not found' }, { status: 404 });
  const channelId = String(body.channel_id ?? process.env.TELEGRAM_BROADCAST_CHAT_ID ?? '');
  if (!channelId) return NextResponse.json({ error: 'channel_id is required' }, { status: 422 });
  const messageText = String(body.message_text ?? renderBroadcast({ displayName: entity.display_name, entityType: entity.entity_type, riskLevel: entity.risk_level, riskScore: entity.risk_score, sourceCount: entity.source_count, summary: entity.description, updatedAt: entity.updated_at }));
  const { data, error } = await supabase.from('scam_broadcasts').insert({ entity_id: entity.id, report_id: body.report_id ?? null, channel_type: 'telegram', channel_id: channelId, message_text: messageText, status: 'pending' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  await supabase.from('job_queue').insert({ job_type: 'send_broadcast', payload: { broadcast_id: data.id }, status: 'pending' });
  await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: 'broadcast.create', resource_type: 'scam_broadcast', resource_id: data.id, new_data: { entity_id: entity.id, channel_id: channelId } });
  return NextResponse.json({ broadcast: data }, { status: 201 });
}
