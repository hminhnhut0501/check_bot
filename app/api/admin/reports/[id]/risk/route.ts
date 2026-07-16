import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { calculateRisk } from '@/lib/risk-engine';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  const { data: report } = await supabase.from('scam_reports').select('*').eq('id', id).single();
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  const attachments = await supabase.from('scam_report_attachments').select('id').eq('report_id', id);
  const confirmed = await supabase.from('scam_reports').select('id, reporter_user_id').eq('target_type', report.target_type).eq('target_name', report.target_name).eq('status', 'confirmed');
  const result = calculateRisk({
    confirmedReportCount: confirmed.data?.length ?? 0,
    independentReporterCount: new Set((confirmed.data ?? []).map((item) => item.reporter_user_id).filter(Boolean)).size,
    hasAttachment: (attachments.data?.length ?? 0) > 0,
    hasTransactionEvidence: /transaction|transfer|bank|payment|giao dịch|chuyển khoản/i.test(`${report.description} ${report.evidence_text ?? ''}`),
    sourceCount: new Set((confirmed.data ?? []).map((item) => item.reporter_user_id).filter(Boolean)).size,
  });
  const { data, error } = await supabase.from('scam_reports').update({ risk_score: result.score, confidence_score: Math.min(100, result.score), admin_note: report.admin_note }).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: 'report.recalculate_risk', resource_type: 'scam_report', resource_id: id, new_data: result });
  return NextResponse.json({ report: data, risk: result });
}
