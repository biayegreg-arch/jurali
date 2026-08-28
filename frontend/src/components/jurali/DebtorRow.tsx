import { MotionLink } from './MotionLink';
import { DeleteClientButton } from './DeleteClientButton';
import { listItem, tapScale } from '@/lib/motion';

export interface DebtorRowProps {
  id: string;
  name: string;
  amount: string;
  /** Raw balance (Phase 9) — lets rows distinguish "fully paid" (0) from
   * "current, not yet overdue" (positive, !isOverdue); `amount` alone is
   * already formatted for display and not safe to compare against. */
  balanceFcfa: number;
  daysAgo: number | null;
  lastItem: string;
  isOverdue: boolean;
  index: number;
  /** Optional: shows a trash icon that requests deletion instead of
   * navigating (only the pages that wire up delete pass it). */
  onDelete?: ((id: string, name: string) => void) | undefined;
}

/** A single debtor line item — ported from Banani's shared DebtorRow.jsx. */
export function DebtorRow({
  id,
  name,
  amount,
  balanceFcfa,
  daysAgo,
  lastItem,
  isOverdue,
  index,
  onDelete,
}: DebtorRowProps) {
  return (
    <MotionLink
      href={`/clients/${id}`}
      className={`flex items-center gap-3 px-4 py-3 ${index !== 0 ? 'border-t border-border' : ''}`}
      variants={listItem}
      initial="hidden"
      animate="show"
      custom={index}
      whileTap={tapScale}
    >
      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
        <span className="font-headings font-bold text-base text-secondary-foreground">
          {name.charAt(0)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-headings font-bold text-base text-foreground leading-tight">
          {name}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{lastItem}</div>
      </div>

      <div className="flex flex-col items-end flex-shrink-0">
        <span
          className={`font-headings font-bold text-lg leading-tight ${isOverdue ? 'text-danger' : 'text-foreground'}`}
        >
          {amount}
        </span>
        <span className="text-xs text-muted-foreground mt-0.5">
          {isOverdue
            ? 'En retard'
            : balanceFcfa === 0
              ? 'Payé'
              : daysAgo === null
                ? '—'
                : `${daysAgo}j`}
        </span>
      </div>

      {onDelete && (
        <DeleteClientButton
          id={id}
          name={name}
          onDelete={onDelete}
          className="flex-shrink-0 p-2 -mr-2 text-muted-foreground"
        />
      )}
    </MotionLink>
  );
}
