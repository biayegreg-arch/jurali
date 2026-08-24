import { describe, expect, it } from 'vitest';
import {
  parseMonthParam,
  monthBounds,
  formatMonthParam,
  shiftMonth,
  formatMonthLabelFr,
} from './month-range';

describe('parseMonthParam', () => {
  const now = new Date('2026-08-24T10:00:00Z');

  it('defaults to the current calendar month when no param is given', () => {
    expect(parseMonthParam(null, now)).toEqual({ year: 2026, month: 7 });
  });

  it('parses a valid YYYY-MM param', () => {
    expect(parseMonthParam('2026-03', now)).toEqual({ year: 2026, month: 2 });
  });

  it('falls back to the current month for a malformed param', () => {
    expect(parseMonthParam('not-a-month', now)).toEqual({ year: 2026, month: 7 });
  });

  it('falls back to the current month for an out-of-range month number', () => {
    expect(parseMonthParam('2026-13', now)).toEqual({ year: 2026, month: 7 });
    expect(parseMonthParam('2026-00', now)).toEqual({ year: 2026, month: 7 });
  });
});

describe('monthBounds', () => {
  it('returns [start, end) for a mid-year month', () => {
    const { start, end } = monthBounds(2026, 7); // August (0-indexed)
    expect(start).toEqual(new Date(2026, 7, 1));
    expect(end).toEqual(new Date(2026, 8, 1));
  });

  it('rolls over correctly for December', () => {
    const { start, end } = monthBounds(2026, 11);
    expect(start).toEqual(new Date(2026, 11, 1));
    expect(end).toEqual(new Date(2027, 0, 1));
  });
});

describe('formatMonthParam', () => {
  it('formats as zero-padded YYYY-MM', () => {
    expect(formatMonthParam(2026, 7)).toBe('2026-08');
    expect(formatMonthParam(2026, 0)).toBe('2026-01');
  });
});

describe('shiftMonth', () => {
  it('moves forward within the same year', () => {
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
  });

  it('moves backward within the same year', () => {
    expect(shiftMonth(2026, 5, -1)).toEqual({ year: 2026, month: 4 });
  });

  it('rolls over to the next year from December', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('rolls back to the previous year from January', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('formatMonthLabelFr', () => {
  it('formats a month as a capitalized French "Mois AAAA" label', () => {
    expect(formatMonthLabelFr(2026, 7)).toBe('Août 2026');
    expect(formatMonthLabelFr(2026, 0)).toBe('Janvier 2026');
  });
});
