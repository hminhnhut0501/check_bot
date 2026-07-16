import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json();
  const status = String(body.status ?? '');
  if (!['reviewing', 'accepted', 'rejected', 'closed'].includes(status)) return NextResponse.json({ error: 'Invalid dispute status' }, { status: 422 });
  const supabase = createServerSupabaseClient();
  const { data: dispute } = await supabase.from('disputes').select('*').eq('id', id).single();
  if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
  const { data, error } = await supabase.from('disputes').update({ status, admin_note: String(body.admin_note ?? ''), reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: `dispute.${status}`, resource_type: 'dispute', resource_id: id, old_data: { status: dispute.status }, new_data: { status } });
  if (status === 'accepted' && dispute.entity_id) await supabase.from('scam_entities').update({ status: 'disputed', risk_level: 'unknown' }).eq('id', dispute.entity_id);
  return NextResponse.json({ dispute: data });
}
