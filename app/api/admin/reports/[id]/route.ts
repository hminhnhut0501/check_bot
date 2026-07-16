import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { calculateRisk } from '@/lib/risk-engine';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  const [report, attachments, actions] = await Promise.all([
    supabase.from('scam_reports').select('*').eq('id', id).single(),
    supabase.from('scam_report_attachments').select('*').eq('report_id', id).order('created_at'),
    supabase.from('review_actions').select('*').eq('report_id', id).order('created_at', { ascending: false }),
  ]);
  if (report.error || !report.data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  const risk = calculateRisk({
    confirmedReportCount: report.data.status === 'confirmed' ? 1 : 0,
    hasAttachment: (attachments.data?.length ?? 0) > 0,
    hasTransactionEvidence: /transaction|transfer|bank|payment|giao dịch|chuyển khoản/i.test(`${report.data.description} ${report.data.evidence_text ?? ''}`),
  });
  return NextResponse.json({ report: report.data, attachments: attachments.data ?? [], actions: actions.data ?? [], risk });
}
