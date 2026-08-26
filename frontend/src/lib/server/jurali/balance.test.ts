import { describe, expect, it } from 'vitest';
import {
  computeClientBalance,
  computeDebtStatuses,
  computeOverdueBalance,
  isOverdue,
  oldestUnpaidDebtDate,
} from './balance';

const day = (offsetDays: number) => new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);

describe('computeClientBalance', () => {
  it('returns 0 for a client with no transactions', () => {
    expect(computeClientBalance([])).toBe(0);
  });

  it('returns the full amount for a single unpaid debt', () => {
    expect(computeClientBalance([{ type: 'DEBT', amountFcfa: 12_500 }])).toBe(12_500);
  });

  it('subtracts a partial payment from the debt', () => {
    const balance = computeClientBalance([
      { type: 'DEBT', amountFcfa: 12_500 },
      { type: 'PAYMENT', amountFcfa: 5_000 },
    ]);
    expect(balance).toBe(7_500);
  });

  it('returns 0 when a payment fully clears the debt', () => {
    const balance = computeClientBalance([
      { type: 'DEBT', amountFcfa: 12_500 },
      { type: 'PAYMENT', amountFcfa: 12_500 },
    ]);
    expect(balance).toBe(0);
  });

  it('sums multiple debts and payments across the full history', () => {
    const balance = computeClientBalance([
      { type: 'DEBT', amountFcfa: 10_000 },
      { type: 'DEBT', amountFcfa: 5_000 },
      { type: 'PAYMENT', amountFcfa: 3_000 },
    ]);
    expect(balance).toBe(12_000);
  });
});

describe('oldestUnpaidDebtDate (FIFO aging)', () => {
  it('returns null for a client with no transactions', () => {
    expect(oldestUnpaidDebtDate([])).toBeNull();
  });

  it('returns the debt date for a single unpaid debt', () => {
    const debtDate = day(5);
    expect(
      oldestUnpaidDebtDate([{ type: 'DEBT', amountFcfa: 12_500, createdAt: debtDate }]),
    ).toEqual(debtDate);
  });

  it('returns null once the only debt is fully paid', () => {
    const result = oldestUnpaidDebtDate([
      { type: 'DEBT', amountFcfa: 12_500, createdAt: day(5) },
      { type: 'PAYMENT', amountFcfa: 12_500, createdAt: day(1) },
    ]);
    expect(result).toBeNull();
  });

  it('clears the oldest debt first when a payment only covers part of the history (FIFO)', () => {
    const oldDebt = day(40);
    const newDebt = day(2);
    const result = oldestUnpaidDebtDate([
      { type: 'DEBT', amountFcfa: 5_000, createdAt: oldDebt },
      { type: 'DEBT', amountFcfa: 5_000, createdAt: newDebt },
      { type: 'PAYMENT', amountFcfa: 5_000, createdAt: day(1) },
    ]);
    expect(result).toEqual(newDebt);
  });

  it('sorts out-of-order input chronologically before applying FIFO', () => {
    const oldDebt = day(40);
    const newDebt = day(2);
    const result = oldestUnpaidDebtDate([
      { type: 'DEBT', amountFcfa: 5_000, createdAt: newDebt },
      { type: 'PAYMENT', amountFcfa: 5_000, createdAt: day(1) },
      { type: 'DEBT', amountFcfa: 5_000, createdAt: oldDebt },
    ]);
    expect(result).toEqual(newDebt);
  });
});

describe('isOverdue', () => {
  it('is false when there is no unpaid debt', () => {
    expect(isOverdue([], day(0))).toBe(false);
  });

  it('is false when the oldest unpaid debt is under 30 days old', () => {
    const transactions = [{ type: 'DEBT' as const, amountFcfa: 5_000, createdAt: day(10) }];
    expect(isOverdue(transactions, day(0))).toBe(false);
  });

  it('is true when the oldest unpaid debt is over 30 days old', () => {
    const transactions = [{ type: 'DEBT' as const, amountFcfa: 5_000, createdAt: day(45) }];
    expect(isOverdue(transactions, day(0))).toBe(true);
  });
});

describe('computeDebtStatuses (per-debt FIFO status)', () => {
  it('returns an empty map for no transactions', () => {
    expect(computeDebtStatuses([], day(0)).size).toBe(0);
  });

  it('marks a single unpaid debt as UNPAID when under the overdue threshold', () => {
    const statuses = computeDebtStatuses(
      [{ id: 'd1', type: 'DEBT', amountFcfa: 5_000, createdAt: day(10) }],
      day(0),
    );
    expect(statuses.get('d1')).toBe('UNPAID');
  });

  it('marks a single unpaid debt as OVERDUE past the threshold', () => {
    const statuses = computeDebtStatuses(
      [{ id: 'd1', type: 'DEBT', amountFcfa: 5_000, createdAt: day(45) }],
      day(0),
    );
    expect(statuses.get('d1')).toBe('OVERDUE');
  });

  it('marks a debt PAID once a payment fully covers it', () => {
    const statuses = computeDebtStatuses(
      [
        { id: 'd1', type: 'DEBT', amountFcfa: 5_000, createdAt: day(45) },
        { id: 'p1', type: 'PAYMENT', amountFcfa: 5_000, createdAt: day(1) },
      ],
      day(0),
    );
    expect(statuses.get('d1')).toBe('PAID');
  });

  it('clears the oldest debt first (FIFO) leaving the newer one UNPAID', () => {
    const statuses = computeDebtStatuses(
      [
        { id: 'old', type: 'DEBT', amountFcfa: 5_000, createdAt: day(40) },
        { id: 'new', type: 'DEBT', amountFcfa: 5_000, createdAt: day(2) },
        { id: 'p1', type: 'PAYMENT', amountFcfa: 5_000, createdAt: day(1) },
      ],
      day(0),
    );
    expect(statuses.get('old')).toBe('PAID');
    expect(statuses.get('new')).toBe('UNPAID');
  });

  it('leaves a partially-paid debt UNPAID (not PAID) until fully covered', () => {
    const statuses = computeDebtStatuses(
      [
        { id: 'd1', type: 'DEBT', amountFcfa: 5_000, createdAt: day(10) },
        { id: 'p1', type: 'PAYMENT', amountFcfa: 2_000, createdAt: day(1) },
      ],
      day(0),
    );
    expect(statuses.get('d1')).toBe('UNPAID');
  });
});

describe('computeOverdueBalance (FIFO remaining sum of >30-day debts)', () => {
  it('returns 0 for a client with no transactions', () => {
    expect(computeOverdueBalance([], day(0))).toBe(0);
  });

  it('returns 0 when the oldest unpaid debt is under 30 days old', () => {
    const transactions = [{ type: 'DEBT' as const, amountFcfa: 5_000, createdAt: day(10) }];
    expect(computeOverdueBalance(transactions, day(0))).toBe(0);
  });

  it('returns the full remaining amount of a single overdue debt', () => {
    const transactions = [{ type: 'DEBT' as const, amountFcfa: 20_000, createdAt: day(45) }];
    expect(computeOverdueBalance(transactions, day(0))).toBe(20_000);
  });

  it('excludes a fresh debt while still counting an older overdue one (FIFO)', () => {
    const transactions = [
      { type: 'DEBT' as const, amountFcfa: 20_000, createdAt: day(45) },
      { type: 'DEBT' as const, amountFcfa: 5_000, createdAt: day(2) },
    ];
    expect(computeOverdueBalance(transactions, day(0))).toBe(20_000);
  });

  it('reflects a partial payment against the overdue debt (FIFO remaining, not the original amount)', () => {
    const transactions = [
      { type: 'DEBT' as const, amountFcfa: 20_000, createdAt: day(45) },
      { type: 'PAYMENT' as const, amountFcfa: 8_000, createdAt: day(1) },
    ];
    expect(computeOverdueBalance(transactions, day(0))).toBe(12_000);
  });

  it('returns 0 once the overdue debt is fully paid off', () => {
    const transactions = [
      { type: 'DEBT' as const, amountFcfa: 20_000, createdAt: day(45) },
      { type: 'PAYMENT' as const, amountFcfa: 20_000, createdAt: day(1) },
    ];
    expect(computeOverdueBalance(transactions, day(0))).toBe(0);
  });
});
