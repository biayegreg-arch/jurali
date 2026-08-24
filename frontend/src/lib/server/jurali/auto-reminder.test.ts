import { describe, expect, it } from 'vitest';
import { isDueForAutoReminder } from './auto-reminder';

const day = (offsetDays: number) => new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);

function candidate(over: Partial<Parameters<typeof isDueForAutoReminder>[0]> = {}) {
  return {
    phone: '+221771234567',
    balanceFcfa: 12_500,
    oldestUnpaidDebtDate: day(8),
    lastReminderSentAt: null,
    ...over,
  };
}

describe('isDueForAutoReminder', () => {
  it('is true for a client with a phone, an outstanding balance, and a debt 7+ days old with no reminder sent', () => {
    expect(isDueForAutoReminder(candidate())).toBe(true);
  });

  it('is false when the client has no phone', () => {
    expect(isDueForAutoReminder(candidate({ phone: null }))).toBe(false);
  });

  it('is false when the balance is 0', () => {
    expect(isDueForAutoReminder(candidate({ balanceFcfa: 0 }))).toBe(false);
  });

  it('is false when the balance is negative (should never happen, but guard anyway)', () => {
    expect(isDueForAutoReminder(candidate({ balanceFcfa: -100 }))).toBe(false);
  });

  it('is false when there is no unpaid debt', () => {
    expect(isDueForAutoReminder(candidate({ oldestUnpaidDebtDate: null }))).toBe(false);
  });

  it('is false when the oldest unpaid debt is younger than 7 days', () => {
    expect(isDueForAutoReminder(candidate({ oldestUnpaidDebtDate: day(3) }))).toBe(false);
  });

  it('is true at exactly the 7-day boundary', () => {
    expect(isDueForAutoReminder(candidate({ oldestUnpaidDebtDate: day(7) }))).toBe(true);
  });

  it('is false when a reminder was already sent after the debt started aging', () => {
    expect(
      isDueForAutoReminder(candidate({ oldestUnpaidDebtDate: day(8), lastReminderSentAt: day(2) })),
    ).toBe(false);
  });

  it('is true when the last reminder predates the current oldest unpaid debt (older debt paid, new one aged in)', () => {
    expect(
      isDueForAutoReminder(
        candidate({ oldestUnpaidDebtDate: day(8), lastReminderSentAt: day(20) }),
      ),
    ).toBe(true);
  });
});
