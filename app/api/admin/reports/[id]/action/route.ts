import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer, requirePermission } from '@/lib/auth/require-admin';
import { normalizeIdentifier } from '@/lib/reports/normalize';
import { renderBroadcast } from '@/lib/broadcasts/template';

const actions = new Set(['confirm', 'reject', 'duplicate', 'need_more_info', 'assign']);
const terminalStatuses = new Set(['confirmed', 'rejected', 'duplicate', 'closed']);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const action = String(body.action ?? '');
  if (!actions.has(action)) return NextResponse.json({ error: 'Unsupported action' }, { status: 422 });
  if (action !== 'assign' && !String(body.note ?? '').trim()) return NextResponse.json({ error: 'A review note is required' }, { status: 422 });

  if (action === 'confirm') {
    const permission = await requirePermission(request, 'reports.confirm');
    if (permission.response) return permission.response;
  }

  const supabase = createServerSupabaseClient();
  const { data: report, error: readError } = await supabase.from('scam_reports').select('*').eq('id', id).single();
  if (readError || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  if (terminalStatuses.has(report.status) && action !== 'assign') return NextResponse.json({ error: 'Report is already in a terminal state' }, { status: 409 });

  if (action === 'confirm') {
    const message = renderBroadcast({ displayName: report.target_name, entityType: report.target_type, riskLevel: report.risk_score >= 70 ? 'critical' : report.risk_score >= 40 ? 'high' : 'medium', riskScore: Math.max(report.risk_score, report.confidence_score), sourceCount: 1, summary: report.description, updatedAt: new Date().toISOString() });
    const { data, error } = await supabase.rpc('confirm_report_transaction', { p_report_id: id, p_actor_id: auth.user?.id, p_note: String(body.note), p_broadcast_channel: process.env.TELEGRAM_BROADCAST_CHAT_ID ?? null, p_broadcast_message: process.env.TELEGRAM_BROADCAST_CHAT_ID ? message : null });
    if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes('Permission') ? 403 : 409 });
    const refreshed = await supabase.from('scam_reports').select('*').eq('id', id).single();
    return NextResponse.json({ report: refreshed.data, entity_id: data?.entity_id, broadcast_id: data?.broadcast_id });
  }

  if (action === 'assign') {
    const assignedTo = String(body.assigned_to ?? auth.user?.id ?? '');
    const { data, error } = await supabase.from('scam_reports').update({ assigned_to: assignedTo, status: 'assigned' }).eq('id', id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from('review_actions').insert({ report_id: id, actor_id: auth.user?.id, action_type: 'assign', from_status: report.status, to_status: 'assigned', note: String(body.note ?? '') });
    return NextResponse.json({ report: data });
  }

  let targetStatus = action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : action === 'duplicate' ? 'duplicate' : 'need_more_info';
  if (action === 'duplicate' && !body.duplicate_of) return NextResponse.json({ error: 'duplicate_of is required' }, { status: 422 });

  let entityId: string | null = null;
  if (action === 'confirm') {
    const normalized = normalizeIdentifier(report.target_name);
    const existing = await supabase.from('entity_identifiers').select('entity_id').eq('identifier_type', report.target_type).eq('normalized_value', normalized).maybeSingle();
    entityId = existing.data?.entity_id ?? null;
    if (!entityId) {
      const created = await supabase.from('scam_entities').insert({
        entity_type: report.target_type,
        display_name: report.target_name,
        normalized_name: normalized,
        risk_level: report.risk_score >= 70 ? 'critical' : report.risk_score >= 40 ? 'high' : 'medium',
        risk_score: Math.max(report.risk_score, report.confidence_score),
        status: 'active',
        description: report.description,
        source_count: 1,
        confirmed_report_count: 1,
        first_seen_at: report.created_at,
        last_seen_at: report.created_at,
        created_by: auth.user?.id,
        reviewed_by: auth.user?.id,
        reviewed_at: new Date().toISOString(),
      }).select('id').single();
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
      entityId = created.data.id;
      await supabase.from('entity_identifiers').insert({ entity_id: entityId, identifier_type: report.target_type, identifier_value: report.target_name, normalized_value: normalized, is_primary: true });
    } else {
      await supabase.from('scam_entities').update({ status: 'active', confirmed_report_count: (report.confirmed_report_count ?? 0) + 1, last_seen_at: report.created_at, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() }).eq('id', entityId);
    }
  }

  const update: Record<string, unknown> = { status: targetStatus, admin_note: String(body.note ?? ''), reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() };
  if (action === 'duplicate') update.duplicate_of = String(body.duplicate_of);
  const { data: updated, error: updateError } = await supabase.from('scam_reports').update(update).eq('id', id).select('*').single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await supabase.from('review_actions').insert({ report_id: id, actor_id: auth.user?.id, action_type: action, from_status: report.status, to_status: targetStatus, note: String(body.note ?? ''), metadata: entityId ? { entity_id: entityId } : {} });
  await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: `report.${action}`, resource_type: 'scam_report', resource_id: id, old_data: { status: report.status }, new_data: { status: targetStatus, entity_id: entityId } });
  if (action === 'confirm' && entityId && process.env.TELEGRAM_BROADCAST_CHAT_ID) {
    const { data: confirmedEntity } = await supabase.from('scam_entities').select('*').eq('id', entityId).single();
    if (confirmedEntity) {
      const broadcast = await supabase.from('scam_broadcasts').insert({ entity_id: entityId, report_id: id, channel_type: 'telegram', channel_id: process.env.TELEGRAM_BROADCAST_CHAT_ID, message_text: renderBroadcast({ displayName: confirmedEntity.display_name, entityType: confirmedEntity.entity_type, riskLevel: confirmedEntity.risk_level, riskScore: confirmedEntity.risk_score, sourceCount: confirmedEntity.source_count, summary: confirmedEntity.description, updatedAt: confirmedEntity.updated_at }), status: 'pending' }).select('id').single();
      if (broadcast.data) await supabase.from('job_queue').insert({ job_type: 'send_broadcast', payload: { broadcast_id: broadcast.data.id }, status: 'pending' });
    }
  }
  return NextResponse.json({ report: updated, entity_id: entityId });
}
