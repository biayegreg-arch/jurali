// PATCH /api/transactions/[id] — correct the amount of an existing PAYMENT
// (a shopkeeper mistyping a versement is the only case Phase 9's fiche
// client UI exposes this for — DEBT rows stay immutable here, edit via a
// dedicated flow if that's ever needed).
//
// Same TOCTOU guard as POST /api/transactions: the balance-doesn't-go-
// negative check and the write must happen inside one Serializable tx
// behind the per-owner advisory lock, otherwise two concurrent edits (or an
// edit racing a new payment) could both read a stale balance and push the
// client's total below zero.
export const runtime = 'nodejs';

import 'server-only';
import { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance } from '@/lib/server/jurali/balance';
import { lockUserTx } from '@/lib/server/withdrawals/lock';
import { isTransientConflict } from '@/lib/server/prisma-errors';

const Body = z.object({
  amountFcfa: z.number().int().positive(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const { amountFcfa: newAmount } = parsed.data;

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Lock MUST be the first awaited statement — see POST's header comment.
          await lockUserTx(tx, auth.user.sub);

          const existing = await tx.transaction.findUnique({
            where: { id },
            select: { id: true, ownerId: true, clientId: true, type: true },
          });
          if (!existing || existing.ownerId !== auth.user.sub) {
            return {
              ok: false as const,
              response: NextResponse.json(
                { error: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found' },
                { status: 404, headers: { 'x-request-id': ctx.requestId } },
              ),
            };
          }
          if (existing.type !== 'PAYMENT') {
            return {
              ok: false as const,
              response: NextResponse.json(
                {
                  error: 'ONLY_PAYMENTS_EDITABLE',
                  message: 'Only PAYMENT transactions can be edited.',
                },
                { status: 422, headers: { 'x-request-id': ctx.requestId } },
              ),
            };
          }

          // Balance with THIS payment's current effect removed — same
          // invariant as POST's PAYMENT_EXCEEDS_BALANCE check, just recomputed
          // as if this row didn't exist yet, so the new amount is validated
          // against what the client can actually still owe.
          const siblings = await tx.transaction.findMany({
            where: { clientId: existing.clientId, id: { not: existing.id } },
            select: { type: true, amountFcfa: true },
          });
          const balanceExcludingThis = computeClientBalance(
            siblings.map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' })),
          );
          if (newAmount > balanceExcludingThis) {
            return {
              ok: false as const,
              response: NextResponse.json(
                {
                  error: 'PAYMENT_EXCEEDS_BALANCE',
                  message: `Payment (${newAmount}) exceeds the client's balance (${balanceExcludingThis}).`,
                },
                { status: 422, headers: { 'x-request-id': ctx.requestId } },
              ),
            };
          }

          const updated = await tx.transaction.update({
            where: { id: existing.id },
            data: { amountFcfa: newAmount },
            select: {
              id: true,
              clientId: true,
              type: true,
              amountFcfa: true,
              note: true,
              createdAt: true,
            },
          });

          return { ok: true as const, transaction: updated };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (!result.ok) return result.response;

      return NextResponse.json(result.transaction, {
        headers: { 'x-request-id': ctx.requestId },
      });
    } catch (err) {
      if (isTransientConflict(err)) {
        return NextResponse.json(
          { error: 'TRANSIENT_CONFLICT', message: 'Please retry' },
          { status: 409, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }
  });
}
