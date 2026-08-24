// Small Jurali-specific formatting helpers shared by the Dashboard and
// Liste des débiteurs pages (both render ClientSummary rows as DebtorRow).
import { formatPrice } from '@/lib/utils';
import type { ClientSummary } from '@/lib/server/jurali/clients';
import type { DebtorRowProps } from '@/components/jurali/DebtorRow';

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function toDebtorRowProps(summary: ClientSummary, index: number): DebtorRowProps {
  return {
    name: summary.firstName,
    amount: formatPrice(summary.balanceFcfa),
    daysAgo: summary.lastActivityAt ? daysSince(summary.lastActivityAt) : null,
    lastItem: summary.lastNote ?? 'Aucune note',
    isOverdue: summary.isOverdue,
    index,
  };
}
