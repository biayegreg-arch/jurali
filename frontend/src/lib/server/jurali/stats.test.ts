import { describe, expect, it } from 'vitest';
import { computeRecoveryRatePercent, bucketMonthlyTrend, MONTH_LABELS_FR } from './stats';

describe('computeRecoveryRatePercent', () => {
  it('returns 0 when nothing has ever been owed or paid', () => {
    expect(computeRecoveryRatePercent(0, 0)).toBe(0);
  });

  it('computes paid / (paid + currently due), rounded to 1 decimal', () => {
    // 45400 / (45400 + 20600) = 68.78... -> 68.8
    expect(computeRecoveryRatePercent(45_400, 20_600)).toBe(68.8);
  });

  it('returns 100 when everything has been paid off (0 currently due)', () => {
    expect(computeRecoveryRatePercent(50_000, 0)).toBe(100);
  });

  it('returns 0 when nothing has ever been paid (100% still due)', () => {
    expect(computeRecoveryRatePercent(0, 30_000)).toBe(0);
  });
});

describe('bucketMonthlyTrend', () => {
  const months = [
    { year: 2026, month: 5 }, // Jun
    { year: 2026, month: 6 }, // Jul
    { year: 2026, month: 7 }, // Aug
  ];

  it('sums DEBT into newDebtsFcfa and PAYMENT into recoveredFcfa, per month bucket', () => {
    const transactions = [
      { type: 'DEBT' as const, amountFcfa: 10_000, createdAt: new Date(2026, 5, 10) },
      { type: 'PAYMENT' as const, amountFcfa: 4_000, createdAt: new Date(2026, 5, 15) },
      { type: 'DEBT' as const, amountFcfa: 7_000, createdAt: new Date(2026, 7, 2) },
    ];
    const result = bucketMonthlyTrend(transactions, months);
    expect(result).toEqual([
      { month: '2026-06', label: 'Juin', newDebtsFcfa: 10_000, recoveredFcfa: 4_000 },
      { month: '2026-07', label: 'Juil', newDebtsFcfa: 0, recoveredFcfa: 0 },
      { month: '2026-08', label: 'Août', newDebtsFcfa: 7_000, recoveredFcfa: 0 },
    ]);
  });

  it('returns a zeroed bucket per month when there are no transactions at all', () => {
    const result = bucketMonthlyTrend([], months);
    expect(result).toHaveLength(3);
    expect(result.every((m) => m.newDebtsFcfa === 0 && m.recoveredFcfa === 0)).toBe(true);
  });

  it('ignores transactions outside the given month list', () => {
    const transactions = [
      { type: 'DEBT' as const, amountFcfa: 99_999, createdAt: new Date(2025, 0, 1) },
    ];
    const result = bucketMonthlyTrend(transactions, months);
    expect(result.every((m) => m.newDebtsFcfa === 0)).toBe(true);
  });
});

describe('MONTH_LABELS_FR', () => {
  it('has 12 short French month labels, January first', () => {
    expect(MONTH_LABELS_FR).toHaveLength(12);
    expect(MONTH_LABELS_FR[0]).toBe('Jan');
    expect(MONTH_LABELS_FR[11]).toBe('Déc');
  });
});
