import { Icon } from './Icon';

export interface DebtHistoryRowProps {
  note: string;
  amount: string;
  dateLabel: string;
  status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PAYMENT';
  isFirst: boolean;
}

const STATUS_LABEL: Record<DebtHistoryRowProps['status'], string> = {
  PAID: 'Payée',
  UNPAID: 'En cours',
  OVERDUE: 'En retard',
  PAYMENT: 'Paiement',
};

/** One row of a client's debt history — mobile-first stacked card, adapted
 * from Banani's desktop grid table (FicheClient.jsx) which doesn't fit
 * 375px. */
export function DebtHistoryRow({ note, amount, dateLabel, status, isFirst }: DebtHistoryRowProps) {
  const isOverdue = status === 'OVERDUE';
  const isPaid = status === 'PAID';
  const isPayment = status === 'PAYMENT';
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 ${!isFirst ? 'border-t border-border' : ''}`}
    >
      <div className="min-w-0">
        <div className="text-sm text-foreground truncate">{note}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{dateLabel}</div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className={`font-headings font-bold text-sm ${isOverdue ? 'text-danger' : isPayment ? 'text-primary' : 'text-foreground'}`}
        >
          {isPayment ? '−' : ''}
          {amount}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
            isPaid || isPayment
              ? 'bg-green-50 text-green-700'
              : isOverdue
                ? 'bg-red-50 text-danger'
                : 'bg-input text-muted-foreground'
          }`}
        >
          <Icon
            i={isPaid || isPayment ? 'check-circle' : isOverdue ? 'alert-circle' : 'clock'}
            size={11}
          />
          {STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}
