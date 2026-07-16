export type RiskFactor = { code: string; label: string; points: number; evidence?: string };

export type RiskInput = {
  confirmedReportCount?: number;
  independentReporterCount?: number;
  hasTransactionEvidence?: boolean;
  hasAttachment?: boolean;
  sourceCount?: number;
  rejectedReportCount?: number;
  disputeAccepted?: boolean;
  identifierMatch?: boolean;
};

export function calculateRisk(input: RiskInput) {
  const factors: RiskFactor[] = [];
  const add = (code: string, label: string, points: number, evidence?: string) => factors.push({ code, label, points, evidence });
  if ((input.confirmedReportCount ?? 0) > 0) add('confirmed_report', 'Có report đã xác nhận', 40, `${input.confirmedReportCount} report`);
  if ((input.independentReporterCount ?? 0) >= 2) add('independent_reporters', 'Có nhiều reporter độc lập', 25, `${input.independentReporterCount} reporter`);
  if (input.identifierMatch) add('identifier_match', 'Identifier trùng entity đang hoạt động', 15);
  if (input.hasTransactionEvidence) add('transaction_evidence', 'Có bằng chứng giao dịch', 10);
  if ((input.sourceCount ?? 0) >= 2) add('multiple_sources', 'Được đề cập từ nhiều nguồn', 10, `${input.sourceCount} nguồn`);
  if (input.hasAttachment) add('attachment_present', 'Có file bằng chứng', 10);
  if ((input.rejectedReportCount ?? 0) > 0) add('rejected_reports', 'Có report bị bác bỏ', -20, `${input.rejectedReportCount} report`);
  if (input.disputeAccepted) add('accepted_dispute', 'Có dispute hợp lệ', -20);
  const score = Math.max(0, Math.min(100, factors.reduce((sum, factor) => sum + factor.points, 0)));
  const riskLevel = score >= 70 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : score > 0 ? 'low' : 'unknown';
  return { score, riskLevel, factors };
}

export function duplicateScore(a: { target_name: string; target_type: string; description?: string }, b: { target_name: string; target_type: string; description?: string }) {
  const left = a.target_name.trim().toLocaleLowerCase();
  const right = b.target_name.trim().toLocaleLowerCase();
  let score = 0;
  const reasons: string[] = [];
  if (left === right) { score += 70; reasons.push('Tên/identifier trùng hoàn toàn'); }
  else if (left.includes(right) || right.includes(left)) { score += 35; reasons.push('Tên/identifier chứa nhau'); }
  if (a.target_type === b.target_type) { score += 10; reasons.push('Cùng loại đối tượng'); }
  const wordsA = new Set((a.description ?? '').toLocaleLowerCase().split(/\s+/).filter((word) => word.length > 3));
  const commonWords = (b.description ?? '').toLocaleLowerCase().split(/\s+/).filter((word) => wordsA.has(word)).length;
  if (commonWords >= 3) { score += 10; reasons.push('Mô tả có nhiều từ khóa chung'); }
  return { score: Math.min(100, score), reasons };
}
