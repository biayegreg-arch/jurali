// POST /api/transactions — records a DEBT (US-01) or PAYMENT (US-03)
// against an existing client. Client creation is a separate call
// (POST /api/clients first, per US-05's "create on the fly" flow) — kept
// as two requests rather than a union body schema so this route has one
// unambiguous shape.
//
// PAYMENT amounts are capped at the client's current balance (Phase 0
// decision: reject overpayment for V1 rather than let it go negative) —
// stable code PAYMENT_EXCEEDS_BALANCE, mirroring the withdrawals module's
// INSUFFICIENT_BALANCE convention.
//
// Advisory lock + Serializable tx, same pattern as clients.ts/withdrawals.ts:
// the read-balance-then-insert cycle was a TOCTOU race — two concurrent
// PAYMENT POSTs (double-tap, retry-on-timeout) could both read the same
// balance, both pass the PAYMENT_EXCEEDS_BALANCE check, and push the real
// balance negative. This isn't the multi-device offline-sync case PRD §8
// excludes for V1 (that's about reconciling edits made while offline on
// separate devices) — it's plain concurrent-request serialization, so
// `lockUserTx` closes it the same way it does for client creation.
export const runtime = 'nodejs';

import 'server-only';
import { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance, computeOverdueBalance } from '@/lib/server/jurali/balance';
import { requireOwnedClient } from '@/lib/server/jurali/clients';
import { lockUserTx } from '@/lib/server/withdrawals/lock';
import { isTransientConflict } from '@/lib/server/prisma-errors';

const Body = z.object({
  clientId: z.string().min(1),
  type: z.enum(['DEBT', 'PAYMENT']),
  amountFcfa: z.number().int().positive(),
  note: z.string().trim().max(280).optional(),
  // "Marquer les dettes en retard comme payées" (fiche client) computes the
  // overdue amount client-side, off the device's own clock, and used to
  // submit that figure straight through as `amountFcfa` — a wrong device
  // clock could record a payment that doesn't match what's actually 30+
  // days overdue by the server's clock. When set, the server ignores the
  // submitted amountFcfa and recomputes it itself.
  markOverdueOnly: z.literal(true).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

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
    const { clientId, type, note, markOverdueOnly } = parsed.data;
    let { amountFcfa } = parsed.data;

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Lock MUST be the first awaited statement — see header comment.
          await lockUserTx(tx, auth.user.sub);

          const found = await tx.client.findUnique({
            where: { id: clientId },
            select: {
              ownerId: true,
              transactions: { select: { type: true, amountFcfa: true, createdAt: true } },
            },
          });
          const client = requireOwnedClient(found, auth.user.sub, ctx.requestId);
          if (client instanceof NextResponse) {
            return { ok: false as const, response: client };
          }

          // Prisma's `type` column is a plain String (see schema.prisma
          // comment); cast since every row was written through this same
          // route's `z.enum(['DEBT', 'PAYMENT'])` contract.
          const aging = client.transactions.map((t) => ({
            ...t,
            type: t.type as 'DEBT' | 'PAYMENT',
          }));

          if (type === 'PAYMENT') {
            if (markOverdueOnly) {
              amountFcfa = computeOverdueBalance(aging, new Date());
              if (amountFcfa <= 0) {
                return {
                  ok: false as const,
                  response: NextResponse.json(
                    { error: 'NOTHING_OVERDUE', message: 'No overdue balance left to settle.' },
                    { status: 422, headers: { 'x-request-id': ctx.requestId } },
                  ),
                };
              }
            }

            const currentBalance = computeClientBalance(aging);
            if (amountFcfa > currentBalance) {
              return {
                ok: false as const,
                response: NextResponse.json(
                  {
                    error: 'PAYMENT_EXCEEDS_BALANCE',
                    message: `Payment (${amountFcfa}) exceeds the client's balance (${currentBalance}).`,
                  },
                  { status: 422, headers: { 'x-request-id': ctx.requestId } },
                ),
              };
            }
          }

          const transaction = await tx.transaction.create({
            data: {
              clientId,
              ownerId: auth.user.sub,
              type,
              amountFcfa,
              ...(note ? { note } : {}),
            },
            select: {
              id: true,
              clientId: true,
              type: true,
              amountFcfa: true,
              note: true,
              createdAt: true,
            },
          });

          return { ok: true as const, transaction };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (!result.ok) return result.response;

      return NextResponse.json(result.transaction, {
        status: 201,
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
