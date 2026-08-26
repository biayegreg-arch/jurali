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
  const sorted = [...transactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const unpaidDebts: { id: string; amountRemaining: number; createdAt: Date }[] = [];
  const statuses = new Map<string, DebtStatus>();

  for (const tx of sorted) {
    if (tx.type === 'DEBT') {
      unpaidDebts.push({ id: tx.id, amountRemaining: tx.amountFcfa, createdAt: tx.createdAt });
      statuses.set(tx.id, 'UNPAID');
      continue;
    }

    let remaining = tx.amountFcfa;
    while (remaining > 0 && unpaidDebts.length > 0) {
      const oldest = unpaidDebts[0]!;
      if (oldest.amountRemaining <= remaining) {
        remaining -= oldest.amountRemaining;
        statuses.set(oldest.id, 'PAID');
        unpaidDebts.shift();
      } else {
        oldest.amountRemaining -= remaining;
        remaining = 0;
      }
    }
  }

  for (const debt of unpaidDebts) {
    const ageDays = (now.getTime() - debt.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > thresholdDays) statuses.set(debt.id, 'OVERDUE');
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
  }

  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return unpaidDebts
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
 * than a single summed total. Deliberately NOT refactored to share the loop
 * with `computeOverdueBalance` — both are money-correctness-critical and
 * already independently tested; a shared-core refactor would widen the
 * blast radius of touching either for no behavioral gain.
 */
export function listOverdueDebts(
  transactions: TransactionWithNote[],
  now: Date = new Date(),
  thresholdDays = 30,
): OverdueDebtRow[] {
  const sorted = [...transactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const unpaidDebts: {
    id: string;
    amountRemaining: number;
    note: string | null;
    createdAt: Date;
  }[] = [];

  for (const tx of sorted) {
    if (tx.type === 'DEBT') {
      unpaidDebts.push({
        id: tx.id,
        amountRemaining: tx.amountFcfa,
        note: tx.note,
        createdAt: tx.createdAt,
      });
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
  }

  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return unpaidDebts
    .filter((d) => now.getTime() - d.createdAt.getTime() > thresholdMs)
    .map((d) => ({
      id: d.id,
      amountFcfa: d.amountRemaining,
      note: d.note,
      createdAt: d.createdAt,
    }));
}

export interface DebtPaymentEvent {
  paymentId: string;
  amountAppliedFcfa: number;
  remainingAfterFcfa: number;
  createdAt: Date;
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
  const sorted = [...transactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const unpaidDebts: {
    id: string;
    originalAmount: number;
    amountRemaining: number;
    createdAt: Date;
    events: DebtPaymentEvent[];
  }[] = [];

  for (const tx of sorted) {
    if (tx.type === 'DEBT') {
      unpaidDebts.push({
        id: tx.id,
        originalAmount: tx.amountFcfa,
        amountRemaining: tx.amountFcfa,
        createdAt: tx.createdAt,
        events: [],
      });
      continue;
    }

    let remaining = tx.amountFcfa;
    while (remaining > 0 && unpaidDebts.length > 0) {
      const oldest = unpaidDebts[0]!;
      const applied = Math.min(oldest.amountRemaining, remaining);
      oldest.amountRemaining -= applied;
      remaining -= applied;
      oldest.events.push({
        paymentId: tx.id,
        amountAppliedFcfa: applied,
        remainingAfterFcfa: oldest.amountRemaining,
        createdAt: tx.createdAt,
      });
      if (oldest.amountRemaining === 0) unpaidDebts.shift();
    }
  }

  const target = unpaidDebts[0];
  if (!target) return null;
  return {
    debtId: target.id,
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
  const ageDays = (now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > thresholdDays;
}
