import Link from 'next/link';
import type { DebtorRowProps } from './DebtorRow';

/**
 * Desktop table-row rendering of the same debtor data `DebtorRow` renders
 * as a mobile card — see `.planning/banani/debtor-list.md` § Desktop
 * sidebar + table. Reuses `DebtorRowProps` so the amount/daysAgo/lastItem
 * derivation (`toDebtorRowProps`) isn't duplicated between the two.
 */
export function DebtorTableRow({
  id,
  name,
  amount,
  balanceFcfa,
  daysAgo,
  lastItem,
  isOverdue,
}: DebtorRowProps) {
  return (
    <Link href={`/clients/${id}`} className="flex items-center px-6 py-4 hover:bg-input">
      <div className="w-12 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <span className="font-headings font-bold text-base text-secondary-foreground">
            {name.charAt(0)}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 pl-2">
        <div className="font-headings font-bold text-base text-foreground">{name}</div>
        <div className="text-sm text-muted-foreground truncate">{lastItem}</div>
      </div>

      <div className="w-32 text-right flex-shrink-0">
        <span
          className={`font-headings font-bold text-base ${isOverdue ? 'text-danger' : 'text-foreground'}`}
        >
          {amount}
        </span>
      </div>

      <div className="w-24 text-right flex-shrink-0">
        <span className="text-sm text-muted-foreground">
          {daysAgo === null ? '—' : `${daysAgo}j`}
        </span>
      </div>

      <div className="w-24 text-right flex-shrink-0">
        {isOverdue ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-danger/10 text-danger font-body font-bold text-xs">
            En retard
          </span>
        ) : balanceFcfa === 0 ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 font-body font-bold text-xs">
            Payé
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground font-body font-bold text-xs">
            À jour
          </span>
        )}
      </div>
    </Link>
  );
}
