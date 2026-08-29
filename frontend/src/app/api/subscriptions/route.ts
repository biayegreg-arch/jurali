// GET/POST /api/subscriptions — Jurali Phase 7 Premium (PRD §4/§6, US-06).
//
// Unlike /api/orders (one row per purchase attempt, client-supplied
// Idempotency-Key), Subscription is ONE row per user reused across
// renewals (`ownerId @unique`) — so the row's own uniqueness is the
// replay guard: a second POST while a checkout is already PENDING/ACTIVE
// returns the existing outcome instead of creating a duplicate charge.
// No client-supplied idempotency key is needed. Mirrors /api/orders'
// CircuitBreaker + lazy-provider-init + PUBLIC_URL fail-closed handling
// (see that route for the source pattern).
//
// "Active" is never trusted from `status` alone — see
// lib/server/jurali/../subscriptions/guards.ts `isSubscriptionActive`.
// This means no expiration cron is needed to keep the free-tier gate
// (POST /api/clients) correct; a lapsed ACTIVE row simply stops counting
// once `renewsAt` passes.
export const runtime = 'nodejs';

import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { prisma } from '@/lib/server/prisma';
import { CircuitOpenError } from '@/lib/server/payments/circuit-breaker';
import {
  breaker,
  getProvider,
  PaymentProviderUnconfiguredError,
} from '@/lib/server/payments/provider-singleton';
import {
  getPremiumMonthlyPriceFcfa,
  isSubscriptionActive,
} from '@/lib/server/subscriptions/guards';
import { lockUserTx } from '@/lib/server/withdrawals/lock';
import { isTransientConflict } from '@/lib/server/prisma-errors';
import { zPhone } from '@/lib/server/zod-helpers';

// Premium checkout's payment-method choice (/premium/checkout) — fixed to
// Senegalese Mobile Money operators, same vocabulary Bictorys accepts
// (see bictorys.ts's mapMethodToBictorysType).
const CheckoutBody = z.object({
  paymentMethod: z.enum(['WAVE', 'ORANGE_MONEY', 'FREE_MONEY']).optional(),
  phone: zPhone.optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const [sub, priceFcfa] = await Promise.all([
      prisma.subscription.findUnique({ where: { ownerId: auth.user.sub } }),
      getPremiumMonthlyPriceFcfa(prisma),
    ]);

    return NextResponse.json(
      {
        status: sub?.status ?? 'NONE',
        renewsAt: sub?.renewsAt ?? null,
        isActive: isSubscriptionActive(sub),
        planAmountFcfa: priceFcfa,
        paymentMethod: sub?.paymentMethod ?? null,
        paymentPhone: sub?.paymentPhone ?? null,
        createdAt: sub?.createdAt ?? null,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = CheckoutBody.safeParse(await req.json().catch(() => ({})));
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
    const { paymentMethod, phone } = parsed.data;

    let provider;
    try {
      provider = getProvider();
    } catch (err) {
      if (err instanceof PaymentProviderUnconfiguredError) {
        return NextResponse.json(
          { error: 'PAYMENT_PROVIDER_UNCONFIGURED', message: 'Payment provider not configured' },
          { status: 503, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }

    const envPublicUrl = process.env.PUBLIC_URL;
    if (!envPublicUrl && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'PAYMENT_PROVIDER_UNCONFIGURED',
          message: 'PUBLIC_URL not set; cannot construct success/failure redirect URLs.',
        },
        { status: 503, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const publicUrl = envPublicUrl ?? 'http://localhost:3000';
    const priceFcfa = await getPremiumMonthlyPriceFcfa(prisma);

    // The read-then-upsert below used to run unguarded: two concurrent POSTs
    // could both read a non-PENDING `existing` row before either upsert
    // committed, and both would go on to call provider.charge() — a real
    // double charge. The lock serializes them so the second request sees
    // the first's just-created PENDING row and exits via one of the early
    // branches below instead of ever reaching provider.charge().
    let gate;
    try {
      gate = await prisma.$transaction(
        async (tx) => {
          await lockUserTx(tx, auth.user.sub);
          const existing = await tx.subscription.findUnique({ where: { ownerId: auth.user.sub } });

          if (isSubscriptionActive(existing)) {
            return { kind: 'already-subscribed' as const };
          }
          if (existing?.status === 'PENDING') {
            if (existing.paymentUrl) {
              // Replay — same in-flight checkout, don't double-charge.
              return { kind: 'pending-replay' as const, paymentUrl: existing.paymentUrl };
            }
            // Crash-race guard (mirrors /api/orders WR-01): a prior attempt
            // created the row but never got a paymentUrl back.
            return { kind: 'in-flight' as const };
          }

          const row = await tx.subscription.upsert({
            where: { ownerId: auth.user.sub },
            create: {
              ownerId: auth.user.sub,
              status: 'PENDING',
              planAmountFcfa: priceFcfa,
              paymentMethod: paymentMethod ?? null,
              paymentPhone: phone ?? null,
            },
            update: {
              status: 'PENDING',
              planAmountFcfa: priceFcfa,
              providerChargeId: null,
              paymentUrl: null,
              paymentMethod: paymentMethod ?? null,
              paymentPhone: phone ?? null,
            },
          });
          return { kind: 'proceed' as const, subscription: row };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (isTransientConflict(err)) {
        return NextResponse.json(
          { error: 'TRANSIENT_CONFLICT', message: 'Please retry' },
          { status: 409, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }

    if (gate.kind === 'already-subscribed') {
      return NextResponse.json(
        { error: 'ALREADY_SUBSCRIBED', message: 'Already on an active Premium subscription.' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    if (gate.kind === 'pending-replay') {
      return NextResponse.json(
        { status: 'PENDING', paymentUrl: gate.paymentUrl },
        { status: 200, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    if (gate.kind === 'in-flight') {
      return NextResponse.json(
        { error: 'PAYMENT_IN_FLIGHT', message: 'Prior attempt did not complete; retry shortly.' },
        {
          status: 503,
          headers: { 'x-request-id': ctx.requestId, 'Retry-After': '5' },
        },
      );
    }

    const subscription = gate.subscription;

    try {
      // externalRef must be unique PER CHECKOUT ATTEMPT (Bictorys treats it
      // as a merchant idempotency key) — unlike Order, this row is reused
      // across renewals, so `subscription.id` alone would collide on the
      // next billing cycle. Correlating the webhook back to this row uses
      // `providerChargeId` (Bictorys' own charge id), not this ref.
      const result = await breaker.execute(() =>
        provider.charge({
          amount: priceFcfa,
          currency: 'XOF',
          customer: { email: auth.user.email, ...(phone ? { phone } : {}) },
          ...(paymentMethod ? { metadata: { paymentType: paymentMethod } } : {}),
          successUrl: `${publicUrl}/premium/success`,
          failureUrl: `${publicUrl}/premium/failed`,
          // Bictorys' paymentReference rejects dashes (E400-46) — strip them
          // from the UUID suffix; alphanumeric + underscore only.
          externalRef: `sub_${subscription.id}_${randomUUID().replace(/-/g, '')}`,
        }),
      );

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          provider: 'bictorys',
          providerChargeId: result.providerChargeId,
          paymentUrl: result.paymentUrl,
        },
      });

      return NextResponse.json(
        { status: 'PENDING', paymentUrl: result.paymentUrl },
        { status: 201, headers: { 'x-request-id': ctx.requestId } },
      );
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'FAILED' },
        });
        const retryAfterSec = Math.max(1, Math.ceil((err.retryAt.getTime() - Date.now()) / 1000));
        return NextResponse.json(
          {
            error: 'PAYMENT_PROVIDER_UNAVAILABLE',
            message: 'Payment provider temporarily unavailable. Try again shortly.',
          },
          {
            status: 503,
            headers: { 'x-request-id': ctx.requestId, 'Retry-After': String(retryAfterSec) },
          },
        );
      }

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'FAILED' },
      });
      const message = err instanceof Error ? err.message : 'Unknown payment error';
      return NextResponse.json(
        { error: 'PAYMENT_FAILED', message },
        { status: 502, headers: { 'x-request-id': ctx.requestId } },
      );
    }
  });
}

// Gestion Premium's "Résilier l'abonnement" — immediate revocation, not
// cancel-at-period-end. Mobile Money has no auto-debit to stop, so there is
// no recurring charge to cancel; this simply flips the status a lapsed
// subscription would eventually reach on its own, right now, forfeiting
// any remaining paid days (the confirm dialog says so explicitly).
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const existing = await prisma.subscription.findUnique({ where: { ownerId: auth.user.sub } });
    if (!existing) {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription to cancel.' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    await prisma.subscription.update({
      where: { ownerId: auth.user.sub },
      data: { status: 'CANCELED' },
    });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
