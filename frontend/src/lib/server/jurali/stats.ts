// Pure aggregation helpers for GET /api/stats (Banani's `StatisticsDesktop`
// screen) — kept free of Prisma so they're trivially unit-testable, same
// split as balance.ts / month-range.ts. No `'server-only'` marker: nothing
// here touches secrets or the DB.
import type { YearMonth } from './month-range';
import { formatMonthParam } from './month-range';

/** Short French month labels, matching Banani's own mock data (not
 * `Intl.DateTimeFormat`'s longer "janv." / "févr." abbreviations). */
export const MONTH_LABELS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sept',
  'Oct',
  'Nov',
  'Déc',
] as const;

/**
 * "Of everything ever owed (paid + still due), what fraction has been
 * collected" — confirmed formula (2026-08-26): totalPaid / (totalPaid +
 * totalDueFcfa), as a percentage rounded to 1 decimal. `totalDueFcfa` must
 * be the same per-client-clipped-at-0 figure the Dashboard/clients list
 * use (not a raw lifetime debt sum) so this stays consistent with every
 * other "due" figure shown elsewhere in the app.
 */
export function computeRecoveryRatePercent(totalPaidFcfa: number, totalDueFcfa: number): number {
  const denominator = totalPaidFcfa + totalDueFcfa;
  if (denominator <= 0) return 0;
  return Math.round((totalPaidFcfa / denominator) * 1000) / 10;
}

export interface MonthlyTrendTransaction {
  type: 'DEBT' | 'PAYMENT';
  amountFcfa: number;
  createdAt: Date;
}

export interface MonthlyTrendBucket {
  /** `YYYY-MM` */
  month: string;
  /** Short French label, e.g. "Août" */
  label: string;
  newDebtsFcfa: number;
  recoveredFcfa: number;
}

/**
 * Buckets transactions into the given ordered list of calendar months
 * (oldest first). A single `findMany` over the window + in-app bucketing
 * (same "no computed-column SQL for no real scale benefit" reasoning as
 * `clients.ts`'s `listClientSummaries`) rather than N aggregate queries.
 */
export function bucketMonthlyTrend(
  transactions: MonthlyTrendTransaction[],
  months: YearMonth[],
): MonthlyTrendBucket[] {
  const buckets = new Map<string, MonthlyTrendBucket>();
  for (const { year, month } of months) {
    const key = formatMonthParam(year, month);
    buckets.set(key, {
      month: key,
      label: MONTH_LABELS_FR[month]!,
      newDebtsFcfa: 0,
      recoveredFcfa: 0,
    });
  }

  for (const tx of transactions) {
    const key = formatMonthParam(tx.createdAt.getFullYear(), tx.createdAt.getMonth());
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside the requested window
    if (tx.type === 'DEBT') bucket.newDebtsFcfa += tx.amountFcfa;
    else bucket.recoveredFcfa += tx.amountFcfa;
  }

  return months.map(({ year, month }) => buckets.get(formatMonthParam(year, month))!);
}
