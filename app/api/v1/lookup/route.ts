import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeIdentifier } from '@/lib/reports/normalize';
import { maskPublicValue } from '@/lib/privacy/mask';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query || query.length < 2) return NextResponse.json({ error: 'q must contain at least 2 characters' }, { status: 422 });

  const normalized = normalizeIdentifier(query);
  const supabase = createServerSupabaseClient();
  const [entities, identifiers, aliases] = await Promise.all([
    supabase.from('scam_entities').select('id, entity_type, display_name, risk_level, risk_score, status, source_count, confirmed_report_count, updated_at').eq('status', 'active').or(`normalized_name.eq.${normalized},display_name.ilike.%${query}%`).limit(20),
    supabase.from('entity_identifiers').select('entity_id, identifier_type, identifier_value, normalized_value').or(`normalized_value.eq.${normalized},normalized_value.ilike.%${normalized}%`).limit(20),
    supabase.from('scam_aliases').select('entity_id, alias, alias_type').or(`normalized_alias.eq.${normalized},normalized_alias.ilike.%${normalized}%`).limit(20),
  ]);
  if (entities.error || identifiers.error || aliases.error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });

  const ids = new Set([
    ...(entities.data ?? []).map((item) => item.id),
    ...(identifiers.data ?? []).map((item) => item.entity_id),
    ...(aliases.data ?? []).map((item) => item.entity_id),
  ]);
  const matches = (entities.data ?? []).map((entity) => ({ ...entity, display_name: maskPublicValue(entity.display_name, entity.entity_type), result_type: 'entity' }));
  for (const entityId of ids) {
    if (matches.some((item) => item.id === entityId)) continue;
    const entity = await supabase.from('scam_entities').select('id, entity_type, display_name, risk_level, risk_score, status, source_count, confirmed_report_count, updated_at').eq('id', entityId).eq('status', 'active').maybeSingle();
    if (entity.data) matches.push({ ...entity.data, display_name: maskPublicValue(entity.data.display_name, entity.data.entity_type), result_type: 'identifier_or_alias' });
  }
  return NextResponse.json({ query, normalized_query: normalized, matches, match_count: matches.length, disclaimer: 'Không tìm thấy dữ liệu không đồng nghĩa an toàn.' });
}
