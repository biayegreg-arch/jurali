/**
 * POST /api/webhooks/bictorys — Bictorys payment webhook adapter.
 *
 * Thin shim over the battle-tested factory at `lib/server/webhook/handler.ts`
 * (PROTECTED — never modified). The factory does ALL the hard work: raw-body
 * read via arrayBuffer, HMAC verify, Serializable transaction, WebhookLog
 * upsert + dedup, dispatch, processedAt write-back. This file only wires:
 *   - the Bictorys-specific WebhookProvider (HMAC + payload parser)
 *   - per-event handlers that update Order rows + emit outbox events
 *
 * CLAUDE.md invariants honored here:
 *   - runtime = 'nodejs' is exported below (Buffer/crypto + Prisma — the
 *     runtime-enforcement test fails CI otherwise).
 *   - dynamic = 'force-dynamic' is exported below (prevents accidental POST
 *     caching by Next.js).
 *   - This file NEVER reads the request body. The factory itself reads the
 *     raw bytes for byte-identical HMAC verification — reading the body here
 *     would be a silent HMAC regression.
 *   - Side-effects use enqueueOutbox(tx, ...) INSIDE the same Serializable tx
 *     the factory opens — never via after-commit closures (D-04 outbox-not-
 *     closures invariant).
 *
 * Phase 5 / Plan 05-02. WH-01 + WH-02.
 *
 * Phase 7 — also correlates `Subscription.providerChargeId` when no Order
 * matches (Premium checkout reuses the same PaymentProvider.charge() flow,
 * see /api/subscriptions). No new outbox `kind` is emitted for subscription
 * events — same reasoning as onRefunded below: the kind→handler switch
 * lives inside the PROTECTED outbox/dispatcher.ts, so a new kind would
 * require editing it. Subscription "active" is a live renewsAt computation
 * (lib/server/subscriptions/guards.ts) — the frontend polls GET
 * /api/subscriptions rather than needing a push notification here.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import 'server-only';
import { createWebhookHandler } from '@/lib/server/webhook/handler';
import { bictorysWebhookProvider } from '@/lib/server/webhook/bictorys';
import { enqueueOutbox } from '@/lib/server/outbox';
import { prisma } from '@/lib/server/prisma';
import { SUBSCRIPTION_PERIOD_DAYS } from '@/lib/server/subscriptions/guards';

export const POST = createWebhookHandler({
  prisma,
  provider: bictorysWebhookProvider,

  async onPaid(payload, tx) {
    const externalRef = String(payload.charge_id ?? payload.chargeId ?? payload.id ?? '');
    if (!externalRef) return {}; // no id to correlate

    const order = await tx.order.findFirst({
      where: { providerChargeId: externalRef },
    });
    if (!order) {
      // Phase 7 — not an Order charge; try Subscription (Premium checkout).
      const subscription = await tx.subscription.findFirst({
        where: { providerChargeId: externalRef },
      });
      if (!subscription) return {}; // unknown charge — log + drop
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          renewsAt: new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      // Coupon.redemptionCount is informational only (no cap enforced) but
      // must only count CONFIRMED payments, not checkout attempts — an
      // abandoned/failed checkout with a coupon code never reaches here.
      if (subscription.couponId) {
        await tx.coupon.update({
          where: { id: subscription.couponId },
          data: { redemptionCount: { increment: 1 } },
        });
      }
      return {};
    }

    const paymentMethod = payload.payment_method ? String(payload.payment_method) : null;

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(paymentMethod !== null ? { paymentMethod } : {}),
      },
    });

    // Outbox emits stay inside the factory's Serializable tx so the rows
    // commit atomically with the status change. The drain cron picks them up
    // out-of-band.
    if (order.userId) {
      await enqueueOutbox(tx, {
        kind: 'notification.payment_received',
        payload: {
          userId: order.userId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      });
    }
    if (order.customerEmail) {
      await enqueueOutbox(tx, {
        kind: 'email.payment_confirmation',
        payload: {
          to: order.customerEmail,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      });
    }

    return {};
  },

  async onRefunded(payload, tx) {
    const externalRef = String(payload.charge_id ?? payload.chargeId ?? payload.id ?? '');
    if (!externalRef) return {};
    const order = await tx.order.findFirst({
      where: { providerChargeId: externalRef },
    });
    if (!order) {
      // Phase 7 — a refunded Premium charge means the subscription should
      // not remain active; CANCELED (not FAILED — the checkout succeeded,
      // it was reversed after the fact).
      const subscription = await tx.subscription.findFirst({
        where: { providerChargeId: externalRef },
      });
      if (!subscription) return {};
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED' },
      });
      return {};
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' },
    });
    // No outbox emit in v1 — `notification.refund_received` kind is not
    // declared in outbox/types.ts (RESEARCH §"Pattern 1" + A6). Adding it
    // would touch the PROTECTED dispatcher; deferred to a follow-up phase.
    return {};
  },

  async onFailed(payload, tx) {
    const externalRef = String(payload.charge_id ?? payload.chargeId ?? payload.id ?? '');
    if (!externalRef) return {};
    const order = await tx.order.findFirst({
      where: { providerChargeId: externalRef },
    });
    if (!order) {
      // Phase 7 — a failed Premium charge attempt.
      const subscription = await tx.subscription.findFirst({
        where: { providerChargeId: externalRef },
      });
      if (!subscription) return {};
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'FAILED' },
      });
      return {};
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'FAILED' },
    });
    return {};
  },
});
