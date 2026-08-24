export type TransactionType = 'DEBT' | 'PAYMENT';

export interface BalanceTransaction {
  type: TransactionType;
  amountFcfa: number;
}

export interface AgingTransaction extends BalanceTransaction {
  createdAt: Date;
}

export function computeClientBalance(transactions: BalanceTransaction[]): number {
  return transactions.reduce(
    (balance, tx) => (tx.type === 'DEBT' ? balance + tx.amountFcfa : balance - tx.amountFcfa),
    0,
  );
}

/**
 * FIFO aging: payments clear the oldest debts first. Returns the createdAt
 * of the oldest debt that isn't fully covered yet, or null if every debt
 * has been paid off.
 */
export function oldestUnpaidDebtDate(transactions: AgingTransaction[]): Date | null {
  const sorted = [...transactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const unpaidDebts: { amountRemaining: number; createdAt: Date }[] = [];

  for (const tx of sorted) {
    if (tx.type === 'DEBT') {
      unpaidDebts.push({ amountRemaining: tx.amountFcfa, createdAt: tx.createdAt });
      continue;
    }

    let remaining = tx.amountFcfa;
    while (remaining > 0 && unpaidDebts.length > 0) {
      const oldest = unpaidDebts[0]!;
      if (oldest.amountRemaining <= remaining) {
        remaining -= oldest.amountRemaining;
        unpaidDebts.shift();
      } else {
        oldest.amountRemaining -= remaining;
        remaining = 0;
      }
    }
    // Overpayment (remaining > 0 with no unpaid debts left) is rejected at
    // the API layer (Phase 2) — this pure function only tracks aging.
  }

  return unpaidDebts.length > 0 ? unpaidDebts[0]!.createdAt : null;
}

export function isOverdue(
  transactions: AgingTransaction[],
  now: Date = new Date(),
  thresholdDays = 30,
): boolean {
  const oldest = oldestUnpaidDebtDate(transactions);
  if (!oldest) return false;
  const ageDays = (now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > thresholdDays;
}
