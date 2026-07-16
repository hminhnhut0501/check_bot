import { describe, expect, it } from 'vitest';
import { calculateRisk, duplicateScore } from '@/lib/risk-engine';

describe('risk engine', () => {
  it('returns explainable high risk score', () => {
    const result = calculateRisk({ confirmedReportCount: 1, independentReporterCount: 2, hasAttachment: true, hasTransactionEvidence: true });
    expect(result.score).toBe(85);
    expect(result.riskLevel).toBe('critical');
    expect(result.factors).toHaveLength(4);
  });

  it('does not produce a negative score', () => {
    const result = calculateRisk({ rejectedReportCount: 3, disputeAccepted: true });
    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe('unknown');
  });
});

describe('duplicate scoring', () => {
  it('scores exact target matches above partial matches', () => {
    const exact = duplicateScore({ target_name: '0901234567', target_type: 'phone', description: 'same payment' }, { target_name: '0901234567', target_type: 'phone', description: 'same payment' });
    const partial = duplicateScore({ target_name: '0901234567', target_type: 'phone', description: 'same payment' }, { target_name: '090123456', target_type: 'phone', description: 'different' });
    expect(exact.score).toBeGreaterThan(partial.score);
  });
});
