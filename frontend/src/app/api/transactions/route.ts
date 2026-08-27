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
// No advisory lock / Serializable transaction here, unlike withdrawals.ts:
// Jurali is single-device, single-user-typing-sequentially by design (PRD
// §8 explicitly excludes offline conflict resolution for V1), so the
// double-submit race that lock.ts guards against doesn't apply the same
// way. Revisit if Phase 9's multi-device sync ships.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance, computeOverdueBalance } from '@/lib/server/jurali/balance';
import { requireOwnedClient } from '@/lib/server/jurali/clients';

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

    const found = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        ownerId: true,
        transactions: { select: { type: true, amountFcfa: true, createdAt: true } },
      },
    });
    const client = requireOwnedClient(found, auth.user.sub, ctx.requestId);
    if (client instanceof NextResponse) return client;

    // Prisma's `type` column is a plain String (see schema.prisma comment);
    // cast since every row was written through this same route's
    // `z.enum(['DEBT', 'PAYMENT'])` contract.
    const aging = client.transactions.map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' }));

    if (type === 'PAYMENT') {
      if (markOverdueOnly) {
        amountFcfa = computeOverdueBalance(aging, new Date());
        if (amountFcfa <= 0) {
          return NextResponse.json(
            { error: 'NOTHING_OVERDUE', message: 'No overdue balance left to settle.' },
            { status: 422, headers: { 'x-request-id': ctx.requestId } },
          );
        }
      }

      const currentBalance = computeClientBalance(aging);
      if (amountFcfa > currentBalance) {
        return NextResponse.json(
          {
            error: 'PAYMENT_EXCEEDS_BALANCE',
            message: `Payment (${amountFcfa}) exceeds the client's balance (${currentBalance}).`,
          },
          { status: 422, headers: { 'x-request-id': ctx.requestId } },
        );
      }
    }

    const transaction = await prisma.transaction.create({
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

    return NextResponse.json(transaction, {
      status: 201,
      headers: { 'x-request-id': ctx.requestId },
    });
  });
}
