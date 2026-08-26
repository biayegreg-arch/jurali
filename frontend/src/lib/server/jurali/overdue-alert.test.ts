import { describe, expect, it } from 'vitest';
import { countClientsOverdue, OVERDUE_ALERT_THRESHOLD_DAYS } from './overdue-alert';

const day = (offsetDays: number) => new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);

describe('OVERDUE_ALERT_THRESHOLD_DAYS', () => {
  it('is 14 (the daily digest threshold, distinct from the 7-day WhatsApp reminder)', () => {
    expect(OVERDUE_ALERT_THRESHOLD_DAYS).toBe(14);
  });
});

describe('countClientsOverdue', () => {
  it('returns 0 for no clients', () => {
    expect(countClientsOverdue([])).toBe(0);
  });

  it('counts a client whose oldest unpaid debt exceeds the threshold', () => {
    expect(countClientsOverdue([{ oldestUnpaidDebtDate: day(20) }])).toBe(1);
  });

  it('excludes a client whose oldest unpaid debt is under the threshold', () => {
    expect(countClientsOverdue([{ oldestUnpaidDebtDate: day(5) }])).toBe(0);
  });

  it('excludes a client with no unpaid debt at all', () => {
    expect(countClientsOverdue([{ oldestUnpaidDebtDate: null }])).toBe(0);
  });

  it('is true at exactly the 14-day boundary', () => {
    expect(countClientsOverdue([{ oldestUnpaidDebtDate: day(14) }])).toBe(1);
  });

  it('counts multiple qualifying clients, ignoring non-qualifying ones', () => {
    const clients = [
      { oldestUnpaidDebtDate: day(20) },
      { oldestUnpaidDebtDate: day(5) },
      { oldestUnpaidDebtDate: day(15) },
      { oldestUnpaidDebtDate: null },
    ];
    expect(countClientsOverdue(clients)).toBe(2);
  });
});
