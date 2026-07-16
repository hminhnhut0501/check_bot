import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { normalizeIdentifier } from '@/lib/reports/normalize';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? '');
  const supabase = createServerSupabaseClient();
  const { data: source, error: sourceError } = await supabase.from('scam_entities').select('*').eq('id', id).single();
  if (sourceError || !source) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

  if (action === 'enable' || action === 'disable') {
    const status = action === 'enable' ? 'active' : 'disabled';
    const { data, error } = await supabase.from('scam_entities').update({ status, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: `entity.${action}`, resource_type: 'scam_entity', resource_id: id, old_data: { status: source.status }, new_data: { status } });
    return NextResponse.json({ entity: data });
  }

  if (action === 'add_identifier' || action === 'add_alias') {
    const value = String(body.value ?? '').trim();
    if (!value) return NextResponse.json({ error: 'value is required' }, { status: 422 });
    const normalized = normalizeIdentifier(value);
    const payload = action === 'add_identifier'
      ? { entity_id: id, identifier_type: String(body.type ?? 'unknown'), identifier_value: value, normalized_value: normalized, is_primary: Boolean(body.is_primary) }
      : { entity_id: id, alias: value, normalized_alias: normalized, alias_type: String(body.type ?? 'name'), confidence_score: Number(body.confidence_score ?? 80) };
    const query = action === 'add_identifier'
      ? supabase.from('entity_identifiers').insert(payload as { entity_id: string; identifier_type: string; identifier_value: string; normalized_value: string; is_primary: boolean }).select('*').single()
      : supabase.from('scam_aliases').insert(payload as { entity_id: string; alias: string; normalized_alias: string; alias_type: string; confidence_score: number }).select('*').single();
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: `entity.${action}`, resource_type: 'scam_entity', resource_id: id, new_data: payload });
    return NextResponse.json({ item: data }, { status: 201 });
  }

  if (action === 'merge') {
    const targetId = String(body.target_id ?? '');
    if (!targetId || targetId === id) return NextResponse.json({ error: 'A different target_id is required' }, { status: 422 });
    const { data: target } = await supabase.from('scam_entities').select('*').eq('id', targetId).single();
    if (!target) return NextResponse.json({ error: 'Target entity not found' }, { status: 404 });
    const identifiers = await supabase.from('entity_identifiers').select('*').eq('entity_id', id);
    for (const item of identifiers.data ?? []) {
      await supabase.from('entity_identifiers').update({ entity_id: targetId }).eq('id', item.id);
    }
    const aliases = await supabase.from('scam_aliases').select('*').eq('entity_id', id);
    for (const item of aliases.data ?? []) {
      const moved = await supabase.from('scam_aliases').update({ entity_id: targetId }).eq('id', item.id);
      if (moved.error?.code === '23505') await supabase.from('scam_aliases').delete().eq('id', item.id);
    }
    await supabase.from('case_entities').update({ entity_id: targetId }).eq('entity_id', id);
    await supabase.from('scam_entities').update({ status: 'archived', description: `${source.description ?? ''}\nMerged into ${targetId}`.trim(), reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: 'entity.merge', resource_type: 'scam_entity', resource_id: id, old_data: { target_id: targetId }, new_data: { status: 'archived', merged_into: targetId } });
    return NextResponse.json({ entity_id: id, merged_into: targetId });
  }
  return NextResponse.json({ error: 'Unsupported action' }, { status: 422 });
}
