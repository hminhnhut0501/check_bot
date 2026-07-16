import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  const [entity, identifiers, aliases, relations, cases] = await Promise.all([
    supabase.from('scam_entities').select('*').eq('id', id).single(),
    supabase.from('entity_identifiers').select('*').eq('entity_id', id).order('is_primary', { ascending: false }),
    supabase.from('scam_aliases').select('*').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('entity_relations').select('*').or(`source_entity_id.eq.${id},target_entity_id.eq.${id}`).order('created_at', { ascending: false }),
    supabase.from('case_entities').select('case_id, relation_type, confidence_score, cases(*)').eq('entity_id', id),
  ]);
  if (entity.error || !entity.data) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  return NextResponse.json({ entity: entity.data, identifiers: identifiers.data ?? [], aliases: aliases.data ?? [], relations: relations.data ?? [], cases: cases.data ?? [] });
}
