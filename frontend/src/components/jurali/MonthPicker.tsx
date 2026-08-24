'use client';

// Month-picker — Phase 9 (Banani's `MonthPickerView`, a UI affordance for
// browsing history, not a PRD requirement — see roadmap A.3/A.7). Prev/next
// month navigation; "next" disables once you're back at the current month
// (no browsing into the future).
import { Icon } from './Icon';
import {
  parseMonthParam,
  shiftMonth,
  formatMonthParam,
  formatMonthLabelFr,
} from '@/lib/server/jurali/month-range';

export interface MonthPickerProps {
  /** YYYY-MM */
  month: string;
  onChange: (month: string) => void;
}

export function MonthPicker({ month, onChange }: MonthPickerProps) {
  const { year, month: m } = parseMonthParam(month);
  const now = new Date();
  const currentParam = formatMonthParam(now.getFullYear(), now.getMonth());
  const isAtCurrentMonth = month >= currentParam;

  function go(delta: number) {
    const shifted = shiftMonth(year, m, delta);
    onChange(formatMonthParam(shifted.year, shifted.month));
  }

  return (
    <div className="flex items-center justify-between bg-input border border-border rounded-xl px-2 py-2">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Mois précédent"
        className="w-8 h-8 flex items-center justify-center flex-shrink-0"
      >
        <Icon i="chevron-left" size={18} className="text-foreground" />
      </button>
      <span className="font-headings font-bold text-sm text-foreground">
        {formatMonthLabelFr(year, m)}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={isAtCurrentMonth}
        aria-label="Mois suivant"
        className="w-8 h-8 flex items-center justify-center flex-shrink-0 disabled:opacity-30"
      >
        <Icon i="chevron-right" size={18} className="text-foreground" />
      </button>
    </div>
  );
}
