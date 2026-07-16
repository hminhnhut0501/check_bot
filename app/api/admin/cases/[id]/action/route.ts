import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request); if (auth.response) return auth.response;
  const { id } = await context.params; const body = await request.json(); const action = String(body.action ?? ''); const supabase = createServerSupabaseClient();
  const { data: caseRow } = await supabase.from('cases').select('*').eq('id', id).single(); if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  if (action === 'link_report' || action === 'link_entity') {
    const targetId = String(body.target_id ?? ''); if (!targetId) return NextResponse.json({ error: 'target_id is required' }, { status: 422 });
    const payload = action === 'link_report' ? { case_id: id, report_id: targetId, relation_type: body.relation_type ?? 'related' } : { case_id: id, entity_id: targetId, relation_type: body.relation_type ?? 'related', confidence_score: Number(body.confidence_score ?? 80) };
    const query = action === 'link_report' ? supabase.from('case_reports').insert(payload as { case_id: string; report_id: string; relation_type: string }) : supabase.from('case_entities').insert(payload as { case_id: string; entity_id: string; relation_type: string; confidence_score: number });
    const { error } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    await supabase.from('review_actions').insert({ case_id: id, actor_id: auth.user?.id, action_type: action, note: body.note ?? '', metadata: payload });
    return NextResponse.json({ ok: true });
  }
  const allowed = ['open', 'investigating', 'pending_review', 'confirmed', 'monitoring', 'closed', 'archived']; if (!allowed.includes(action)) return NextResponse.json({ error: 'Unsupported action' }, { status: 422 });
  const { data, error } = await supabase.from('cases').update({ status: action, closed_at: action === 'closed' ? new Date().toISOString() : null }).eq('id', id).select('*').single(); if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('review_actions').insert({ case_id: id, actor_id: auth.user?.id, action_type: 'case_status', from_status: caseRow.status, to_status: action, note: body.note ?? '' });
  return NextResponse.json({ case: data });
}
