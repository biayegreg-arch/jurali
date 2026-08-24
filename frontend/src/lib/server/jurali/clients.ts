// Shared client-summary query, used by both GET /api/clients (Phase 2) and
// GET /api/dashboard (Phase 3) — both need the same "balance + isOverdue +
// last activity" computation over every client an owner has. Extracted here
// so the two routes can't drift on how a debt/payment history turns into a
// balance (a financial calculation is exactly the kind of logic that should
// have one implementation, not two copies that could diverge).
import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { computeClientBalance, isOverdue as computeIsOverdue } from './balance';

export interface ClientSummary {
  id: string;
  firstName: string;
  phone: string | null;
  balanceFcfa: number;
  isOverdue: boolean;
  lastActivityAt: string | null;
  lastNote: string | null;
}

const TX_SELECT = { type: true, amountFcfa: true, note: true, createdAt: true } as const;

function summarizeClient(client: {
  id: string;
  firstName: string;
  phone: string | null;
  transactions: { type: string; amountFcfa: number; note: string | null; createdAt: Date }[];
}): ClientSummary {
  // Ascending for the FIFO balance/aging helpers (Phase 1 contract). Prisma's
  // `type` column is a plain String (not a native enum — see schema.prisma
  // comment), so it comes back as `string`; cast once here since every row
  // was written through the `type: z.enum(['DEBT', 'PAYMENT'])` contract in
  // POST /api/transactions.
  const chronological = [...client.transactions]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' }));
  const balanceFcfa = computeClientBalance(chronological);
  const overdue = computeIsOverdue(chronological);
  const last = chronological[chronological.length - 1] ?? null;

  return {
    id: client.id,
    firstName: client.firstName,
    phone: client.phone,
    balanceFcfa,
    isOverdue: overdue,
    lastActivityAt: last ? last.createdAt.toISOString() : null,
    lastNote: last?.note ?? null,
  };
}

/**
 * Every client an owner has, with balance/isOverdue/lastActivityAt computed
 * from their transaction history. `whereExtra` merges into the Prisma
 * where-clause (e.g. Phase 2's `?q=` search) — `ownerId` is always fixed to
 * the caller's own scope, never overridable via `whereExtra`.
 */
export async function listClientSummaries(
  ownerId: string,
  whereExtra: Omit<Prisma.ClientWhereInput, 'ownerId'> = {},
): Promise<ClientSummary[]> {
  const rows = await prisma.client.findMany({
    where: { ...whereExtra, ownerId },
    select: {
      id: true,
      firstName: true,
      phone: true,
      transactions: { select: TX_SELECT },
    },
  });
  return rows.map(summarizeClient);
}
