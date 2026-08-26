import { describe, expect, it } from 'vitest';
import {
  computeClientBalance,
  computeDebtStatuses,
  computeOldestDebtProgress,
  computeOverdueBalance,
  isOverdue,
  listOverdueDebts,
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

describe('listOverdueDebts', () => {
  it('returns an empty list when nothing is overdue', () => {
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 5_000, note: 'Riz', createdAt: day(2) },
    ];
    expect(listOverdueDebts(transactions, day(0))).toEqual([]);
  });

  it('returns one row per overdue debt, carrying id/note/amount/date', () => {
    const debtDate = day(45);
    const transactions = [
      {
        id: 'd1',
        type: 'DEBT' as const,
        amountFcfa: 20_000,
        note: 'Riz 10kg',
        createdAt: debtDate,
      },
    ];
    const rows = listOverdueDebts(transactions, day(0));
    expect(rows).toEqual([{ id: 'd1', amountFcfa: 20_000, note: 'Riz 10kg', createdAt: debtDate }]);
  });

  it('lists multiple overdue debts for the same client (FIFO queue can hold several)', () => {
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 10_000, note: 'A', createdAt: day(60) },
      { id: 'd2', type: 'DEBT' as const, amountFcfa: 5_000, note: 'B', createdAt: day(40) },
    ];
    const rows = listOverdueDebts(transactions, day(0));
    expect(rows.map((r) => r.id)).toEqual(['d1', 'd2']);
  });

  it('excludes a fresh debt while still listing an older overdue one', () => {
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 20_000, note: null, createdAt: day(45) },
      { id: 'd2', type: 'DEBT' as const, amountFcfa: 5_000, note: null, createdAt: day(2) },
    ];
    const rows = listOverdueDebts(transactions, day(0));
    expect(rows.map((r) => r.id)).toEqual(['d1']);
  });

  it('reflects a partial payment as a reduced remaining amount, not the original', () => {
    const debtDate = day(45);
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 20_000, note: null, createdAt: debtDate },
      { id: 'p1', type: 'PAYMENT' as const, amountFcfa: 8_000, note: null, createdAt: day(1) },
    ];
    const rows = listOverdueDebts(transactions, day(0));
    expect(rows).toEqual([{ id: 'd1', amountFcfa: 12_000, note: null, createdAt: debtDate }]);
  });

  it('drops a debt from the list once fully paid off', () => {
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 20_000, note: null, createdAt: day(45) },
      { id: 'p1', type: 'PAYMENT' as const, amountFcfa: 20_000, note: null, createdAt: day(1) },
    ];
    expect(listOverdueDebts(transactions, day(0))).toEqual([]);
  });
});

describe('computeOldestDebtProgress', () => {
  it('returns null when there are no transactions', () => {
    expect(computeOldestDebtProgress([])).toBeNull();
  });

  it('returns null once every debt is fully paid off', () => {
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 12_500, createdAt: day(10) },
      { id: 'p1', type: 'PAYMENT' as const, amountFcfa: 12_500, createdAt: day(2) },
    ];
    expect(computeOldestDebtProgress(transactions)).toBeNull();
  });

  it('tracks a fresh unpaid debt with no payments yet', () => {
    const debtDate = day(5);
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 20_000, createdAt: debtDate },
    ];
    expect(computeOldestDebtProgress(transactions)).toEqual({
      debtId: 'd1',
      originalAmountFcfa: 20_000,
      remainingFcfa: 20_000,
      createdAt: debtDate,
      events: [],
    });
  });

  it('records each payment event against the oldest debt with a running remaining balance', () => {
    const debtDate = day(10);
    const payment1Date = day(5);
    const payment2Date = day(1);
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 20_000, createdAt: debtDate },
      { id: 'p1', type: 'PAYMENT' as const, amountFcfa: 10_000, createdAt: payment1Date },
      { id: 'p2', type: 'PAYMENT' as const, amountFcfa: 5_000, createdAt: payment2Date },
    ];
    const progress = computeOldestDebtProgress(transactions);
    expect(progress).toEqual({
      debtId: 'd1',
      originalAmountFcfa: 20_000,
      remainingFcfa: 5_000,
      createdAt: debtDate,
      events: [
        {
          paymentId: 'p1',
          amountAppliedFcfa: 10_000,
          remainingAfterFcfa: 10_000,
          createdAt: payment1Date,
        },
        {
          paymentId: 'p2',
          amountAppliedFcfa: 5_000,
          remainingAfterFcfa: 5_000,
          createdAt: payment2Date,
        },
      ],
    });
  });

  it('targets the new oldest debt once the previous one is fully paid (FIFO rollover)', () => {
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 10_000, createdAt: day(20) },
      { id: 'd2', type: 'DEBT' as const, amountFcfa: 8_000, createdAt: day(10) },
      { id: 'p1', type: 'PAYMENT' as const, amountFcfa: 10_000, createdAt: day(5) },
    ];
    const progress = computeOldestDebtProgress(transactions);
    expect(progress?.debtId).toBe('d2');
    expect(progress?.remainingFcfa).toBe(8_000);
    expect(progress?.events).toEqual([]);
  });

  it('splits a single payment across two debts, only attributing the second slice to the new oldest debt', () => {
    const debt2Date = day(10);
    const paymentDate = day(5);
    const transactions = [
      { id: 'd1', type: 'DEBT' as const, amountFcfa: 10_000, createdAt: day(20) },
      { id: 'd2', type: 'DEBT' as const, amountFcfa: 8_000, createdAt: debt2Date },
      { id: 'p1', type: 'PAYMENT' as const, amountFcfa: 13_000, createdAt: paymentDate },
    ];
    const progress = computeOldestDebtProgress(transactions);
    expect(progress).toEqual({
      debtId: 'd2',
      originalAmountFcfa: 8_000,
      remainingFcfa: 5_000,
      createdAt: debt2Date,
      events: [
        {
          paymentId: 'p1',
          amountAppliedFcfa: 3_000,
          remainingAfterFcfa: 5_000,
          createdAt: paymentDate,
        },
      ],
    });
  });
});
