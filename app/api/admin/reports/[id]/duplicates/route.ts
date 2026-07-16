import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { duplicateScore } from '@/lib/risk-engine';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  const { data: source } = await supabase.from('scam_reports').select('id, target_name, target_type, description, created_at').eq('id', id).single();
  if (!source) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  const { data: candidates, error } = await supabase.from('scam_reports').select('id, tracking_code, target_name, target_type, description, status, created_at').neq('id', id).in('status', ['submitted', 'triaged', 'assigned', 'investigating', 'confirmed']).or(`target_type.eq.${source.target_type},target_name.ilike.%${source.target_name}%`).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const scored = (candidates ?? []).map((candidate) => ({ ...candidate, duplicate: duplicateScore(source, candidate) })).filter((candidate) => candidate.duplicate.score >= 35).sort((a, b) => b.duplicate.score - a.duplicate.score);
  return NextResponse.json({ candidates: scored });
}
