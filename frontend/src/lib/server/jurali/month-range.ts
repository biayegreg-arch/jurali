// Month-picker helper — Phase 9 (Banani's `MonthPickerView`, "UI
// affordance for browsing history", not in the PRD). `month` is
// 0-indexed everywhere here (matches `Date`'s own convention), the
// `YYYY-MM` wire format is 1-indexed (human-facing).
export interface YearMonth {
  year: number;
  month: number;
}

const MONTH_PARAM_RE = /^(\d{4})-(\d{2})$/;

export function parseMonthParam(raw: string | null, now: Date = new Date()): YearMonth {
  const current: YearMonth = { year: now.getFullYear(), month: now.getMonth() };
  if (!raw) return current;

  const match = MONTH_PARAM_RE.exec(raw);
  if (!match) return current;

  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) return current;

  return { year, month: monthNum - 1 };
}

export function monthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
}

export function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** No `'server-only'` marker on this module — these two are also used
 * client-side by the MonthPicker component (prev/next nav + label). */
export function shiftMonth(year: number, month: number, delta: number): YearMonth {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

const monthLabelFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export function formatMonthLabelFr(year: number, month: number): string {
  const label = monthLabelFormatter.format(new Date(year, month, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
