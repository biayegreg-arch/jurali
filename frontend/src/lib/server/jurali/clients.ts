// Shared client-summary query, used by both GET /api/clients (Phase 2) and
// GET /api/dashboard (Phase 3) — both need the same "balance + isOverdue +
// last activity" computation over every client an owner has. Extracted here
// so the two routes can't drift on how a debt/payment history turns into a
// balance (a financial calculation is exactly the kind of logic that should
// have one implementation, not two copies that could diverge).
import 'server-only';
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
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

/**
 * The "does this client exist AND belong to this user?" ownership check —
 * duplicated by hand across every `/api/clients/[id]/*` route, each with
 * its own tailored `select`. A future route that copies the comparison
 * wrong (or skips it) would leak or let a user mutate another shopkeeper's
 * client — centralizing the check here means there's exactly one place to
 * get it right. Never distinguish "doesn't exist" from "belongs to someone
 * else" on the wire (same existence-leak principle CLAUDE.md documents for
 * org membership) — both produce the same 404.
 *
 * Callers keep their own `prisma.client.findUnique({ select })` (the
 * generic preserves whatever shape they selected) and pass the result
 * straight through: `const owned = requireOwnedClient(client, ...); if
 * (owned instanceof NextResponse) return owned;`.
 */
export function requireOwnedClient<T extends { ownerId: string } | null>(
  client: T,
  ownerId: string,
  requestId: string,
): NextResponse | Exclude<T, null> {
  if (!client || client.ownerId !== ownerId) {
    return NextResponse.json(
      { error: 'CLIENT_NOT_FOUND', message: 'Client not found' },
      { status: 404, headers: { 'x-request-id': requestId } },
    );
  }
  return client as Exclude<T, null>;
}
