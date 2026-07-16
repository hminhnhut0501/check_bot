import { expect, it } from 'vitest';
import { createTrackingCode, normalizeIdentifier } from '@/lib/reports/normalize';

it('normalizes URL and whitespace safely', () => {
  expect(normalizeIdentifier(' https://www.Example.com/ ')).toBe('example.com');
});

it('creates tracking codes with the expected prefix', () => {
  expect(createTrackingCode()).toMatch(/^RPT-/);
});
