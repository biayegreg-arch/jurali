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

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface DebtPaymentEvent {
  paymentId: string;
  amountAppliedFcfa: number;
  remainingAfterFcfa: number;
  createdAt: Date;
}

interface FifoEntry {
  id?: string;
  amountRemaining: number;
  originalAmount: number;
  createdAt: Date;
  note: string | null;
  events: DebtPaymentEvent[];
}

/**
 * Shared FIFO core: payments clear the oldest debts first. Returns every
 * debt still carrying an unpaid remainder, oldest first, after applying
 * every payment in `transactions`. Every FIFO-derived function below builds
 * its public shape from this single allocation loop — this is
 * money-correctness-critical logic, so a fix to the allocation rule (e.g.
 * tie-breaking, overpayment handling) only has to be made once. Regression
 * safety net: this loop is exercised end-to-end by every case in
 * balance.test.ts (all five public functions below share it).
 */
function allocateFifo(
  transactions: (AgingTransaction & { id?: string; note?: string | null })[],
): FifoEntry[] {
  const sorted = [...transactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const unpaid: FifoEntry[] = [];

  for (const tx of sorted) {
    if (tx.type === 'DEBT') {
      unpaid.push({
        ...(tx.id !== undefined ? { id: tx.id } : {}),
        amountRemaining: tx.amountFcfa,
        originalAmount: tx.amountFcfa,
        createdAt: tx.createdAt,
        note: tx.note ?? null,
        events: [],
      });
      continue;
    }

    let remaining = tx.amountFcfa;
    while (remaining > 0 && unpaid.length > 0) {
      const oldest = unpaid[0]!;
      const applied = Math.min(oldest.amountRemaining, remaining);
      oldest.amountRemaining -= applied;
      remaining -= applied;
      if (tx.id !== undefined) {
        oldest.events.push({
          paymentId: tx.id,
          amountAppliedFcfa: applied,
          remainingAfterFcfa: oldest.amountRemaining,
          createdAt: tx.createdAt,
        });
      }
      if (oldest.amountRemaining === 0) unpaid.shift();
    }
    // Overpayment (remaining > 0 with no unpaid debts left) is rejected at
    // the API layer (Phase 2) — this pure function only tracks aging.
  }

  return unpaid;
}

/**
 * FIFO aging: payments clear the oldest debts first. Returns the createdAt
 * of the oldest debt that isn't fully covered yet, or null if every debt
 * has been paid off.
 */
export function oldestUnpaidDebtDate(transactions: AgingTransaction[]): Date | null {
  const unpaid = allocateFifo(transactions);
  return unpaid.length > 0 ? unpaid[0]!.createdAt : null;
}

export type DebtStatus = 'PAID' | 'UNPAID' | 'OVERDUE';

export interface DebtTransaction extends AgingTransaction {
  id: string;
}

/**
 * Per-debt FIFO status (fiche client history). Same FIFO allocation as
 * `oldestUnpaidDebtDate`, but tracked per transaction id instead of
 * collapsed to a single date — this is a display derivation, not new
 * stored state (no schema change).
 */
export function computeDebtStatuses(
  transactions: DebtTransaction[],
  now: Date = new Date(),
  thresholdDays = 30,
): Map<string, DebtStatus> {
  const unpaid = allocateFifo(transactions);
  const unpaidById = new Map(unpaid.map((d) => [d.id!, d]));
  const statuses = new Map<string, DebtStatus>();

  for (const tx of transactions) {
    if (tx.type !== 'DEBT') continue;
    const entry = unpaidById.get(tx.id);
    if (!entry) {
      statuses.set(tx.id, 'PAID');
      continue;
    }
    const ageDays = (now.getTime() - entry.createdAt.getTime()) / DAY_MS;
    statuses.set(tx.id, ageDays > thresholdDays ? 'OVERDUE' : 'UNPAID');
  }

  return statuses;
}

/**
 * FIFO remaining balance of debts currently overdue (>30 days unpaid) —
 * the "Marquer les dettes en retard comme payées" bulk action's amount
 * (Phase 9, `clients/[id]/page.tsx`): a partial payment already applied to
 * an overdue debt reduces what's left to settle, so this returns the FIFO
 * *remaining* amount, not the original debt total.
 */
export function computeOverdueBalance(
  transactions: AgingTransaction[],
  now: Date = new Date(),
  thresholdDays = 30,
): number {
  const unpaid = allocateFifo(transactions);
  const thresholdMs = thresholdDays * DAY_MS;
  return unpaid
    .filter((d) => now.getTime() - d.createdAt.getTime() > thresholdMs)
    .reduce((sum, d) => sum + d.amountRemaining, 0);
}

export interface TransactionWithNote extends AgingTransaction {
  id: string;
  note: string | null;
}

export interface OverdueDebtRow {
  id: string;
  amountFcfa: number;
  note: string | null;
  createdAt: Date;
}

/**
 * Itemized version of `computeOverdueBalance` (Phase 9, "Dettes en retard"
 * page) — one row per currently-overdue debt (FIFO remaining amount) rather
 * than a single summed total.
 */
export function listOverdueDebts(
  transactions: TransactionWithNote[],
  now: Date = new Date(),
  thresholdDays = 30,
): OverdueDebtRow[] {
  const unpaid = allocateFifo(transactions);
  const thresholdMs = thresholdDays * DAY_MS;
  return unpaid
    .filter((d) => now.getTime() - d.createdAt.getTime() > thresholdMs)
    .map((d) => ({
      id: d.id!,
      amountFcfa: d.amountRemaining,
      note: d.note,
      createdAt: d.createdAt,
    }));
}

export interface OldestDebtProgress {
  debtId: string;
  originalAmountFcfa: number;
  remainingFcfa: number;
  createdAt: Date;
  events: DebtPaymentEvent[];
}

export interface IdentifiedTransaction extends AgingTransaction {
  id: string;
}

/**
 * FIFO paydown progress of the client's current oldest unpaid debt (Phase 9,
 * fiche client "Suivi des paiements") — which payments contributed to it,
 * how much of each was applied, and the running remaining balance after
 * each. Returns null once every debt is fully paid (nothing to track).
 *
 * Not scoped to a specific debt id on purpose: FIFO means only one debt is
 * ever "being paid down" at a time, so "the oldest unpaid debt" is the only
 * sensible target — the same reasoning `oldestUnpaidDebtDate` already uses.
 */
export function computeOldestDebtProgress(
  transactions: IdentifiedTransaction[],
): OldestDebtProgress | null {
  const unpaid = allocateFifo(transactions);
  const target = unpaid[0];
  if (!target) return null;
  return {
    debtId: target.id!,
    originalAmountFcfa: target.originalAmount,
    remainingFcfa: target.amountRemaining,
    createdAt: target.createdAt,
    events: target.events,
  };
}

export function isOverdue(
  transactions: AgingTransaction[],
  now: Date = new Date(),
  thresholdDays = 30,
): boolean {
  const oldest = oldestUnpaidDebtDate(transactions);
  if (!oldest) return false;
  const ageDays = (now.getTime() - oldest.getTime()) / DAY_MS;
  return ageDays > thresholdDays;
}
