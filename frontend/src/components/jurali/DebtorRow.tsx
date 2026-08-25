import Link from 'next/link';

export interface DebtorRowProps {
  id: string;
  name: string;
  amount: string;
  daysAgo: number | null;
  lastItem: string;
  isOverdue: boolean;
  index: number;
}

/** A single debtor line item — ported from Banani's shared DebtorRow.jsx. */
export function DebtorRow({
  id,
  name,
  amount,
  daysAgo,
  lastItem,
  isOverdue,
  index,
}: DebtorRowProps) {
  return (
    <Link
      href={`/clients/${id}`}
      className={`flex items-center gap-3 px-4 py-3 ${index !== 0 ? 'border-t border-border' : ''}`}
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
          {isOverdue ? 'En retard' : daysAgo === null ? '—' : `${daysAgo}j`}
        </span>
      </div>
    </Link>
  );
}
