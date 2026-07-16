import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request); if (auth.response) return auth.response;
  const { id } = await context.params; const supabase = createServerSupabaseClient();
  const [caseRow, reports, entities, actions] = await Promise.all([
    supabase.from('cases').select('*').eq('id', id).single(),
    supabase.from('case_reports').select('*, scam_reports(*)').eq('case_id', id),
    supabase.from('case_entities').select('*, scam_entities(*)').eq('case_id', id),
    supabase.from('review_actions').select('*').eq('case_id', id).order('created_at', { ascending: false }),
  ]);
  if (caseRow.error || !caseRow.data) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  return NextResponse.json({ case: caseRow.data, reports: reports.data ?? [], entities: entities.data ?? [], actions: actions.data ?? [] });
}
