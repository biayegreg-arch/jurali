import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bictorysFixtureRequest } from '@/test-utils/bictorys-mock';

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const orderFindFirst = vi.fn();
const orderUpdate = vi.fn();
const outboxCreate = vi.fn();
const subscriptionFindFirst = vi.fn();
const subscriptionFindUnique = vi.fn();
const subscriptionUpdate = vi.fn();
const couponUpdate = vi.fn();
const subscriptionPaymentCreate = vi.fn();

const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) =>
  fn({
    webhookLog: { findUnique, create, update },
    order: { findFirst: orderFindFirst, update: orderUpdate },
    outboxEvent: { create: outboxCreate },
    subscription: {
      findFirst: subscriptionFindFirst,
      findUnique: subscriptionFindUnique,
      update: subscriptionUpdate,
    },
    coupon: { update: couponUpdate },
    subscriptionPayment: { create: subscriptionPaymentCreate },
  }),
);

vi.mock('@/lib/server/prisma', () => ({
  prisma: { $transaction },
}));

beforeEach(() => {
  vi.stubEnv('BICTORYS_API_URL', 'https://api.bictorys.test');
  vi.stubEnv('BICTORYS_API_KEY', 'test-api-key');
  vi.stubEnv('BICTORYS_WEBHOOK_SECRET', 'test-webhook-secret');
  vi.stubEnv('BICTORYS_WEBHOOK_REPLAY_WINDOW_MS', '60000');
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
  orderFindFirst.mockReset();
  orderUpdate.mockReset();
  outboxCreate.mockReset();
  subscriptionFindFirst.mockReset();
  subscriptionFindUnique.mockReset();
  subscriptionUpdate.mockReset();
  couponUpdate.mockReset();
  subscriptionPaymentCreate.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/webhooks/bictorys', () => {
  it('valid HMAC + first delivery returns 200 deduped:false (WH-01)', async () => {
    findUnique.mockResolvedValueOnce(null); // no existing WebhookLog row
    orderFindFirst.mockResolvedValueOnce(null); // unknown charge — onPaid drops
    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: false });
    expect(create).toHaveBeenCalled(); // WebhookLog row inserted
  });

  it('replay of same (externalId, eventType) returns deduped:true (WH-02)', async () => {
    findUnique.mockResolvedValueOnce({ id: 'wl1', processedAt: new Date() });
    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
    expect(create).not.toHaveBeenCalled(); // no new row written
  });

  it('tampered body returns 401', async () => {
    const { rawBody, headers } = (await import('@/test-utils/bictorys-mock')).bictorysFixture({
      status: 'succeeded',
    });
    const tampered = Buffer.from(rawBody.toString('utf8').replace('succeeded', 'failed'));
    const { POST } = await import('./route');
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/webhooks/bictorys', {
      method: 'POST',
      headers,
      body: tampered,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('expired replay window (drift > 60s) returns 401', async () => {
    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({
      status: 'succeeded',
      timestamp: Date.now() - 70_000, // 70s old
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('onPaid enqueues outbox event when order is found (WH-02 — outbox-not-closures)', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
    });
    outboxCreate.mockResolvedValue({ id: 'ob1' });
    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);
    expect(outboxCreate).toHaveBeenCalled();
    // Assert at least one outbox row's kind starts with 'notification.' or 'email.'
    const kinds = outboxCreate.mock.calls.map(
      (c) => (c[0] as { data: { kind: string } }).data.kind,
    );
    expect(
      kinds.some(
        (k) => k === 'notification.payment_received' || k === 'email.payment_confirmation',
      ),
    ).toBe(true);
  });

  it('exports runtime=nodejs and dynamic=force-dynamic (WH-01)', async () => {
    const mod = (await import('./route')) as { runtime?: string; dynamic?: string };
    expect(mod.runtime).toBe('nodejs');
    expect(mod.dynamic).toBe('force-dynamic');
  });

  describe('Phase 7 — Subscription correlation (no matching Order)', () => {
    it('onPaid activates a Subscription found by providerChargeId', async () => {
      findUnique.mockResolvedValueOnce(null);
      orderFindFirst.mockResolvedValueOnce(null);
      subscriptionFindFirst.mockResolvedValueOnce({
        id: 'sub_1',
        ownerId: 'user_1',
        planAmountFcfa: 2500,
      });
      const { POST } = await import('./route');
      const { req } = bictorysFixtureRequest({ status: 'succeeded' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub_1' },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
      // Permanent ledger row, independent of Subscription.providerChargeId
      // (which the NEXT renewal will overwrite) — see admin-revenue.ts.
      expect(subscriptionPaymentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionId: 'sub_1',
          ownerId: 'user_1',
          status: 'PAID',
          amountFcfa: 2500,
        }),
      });
      // No outbox emit for subscription events (see route.ts comment).
      expect(outboxCreate).not.toHaveBeenCalled();
      // No coupon on this subscription — nothing to increment.
      expect(couponUpdate).not.toHaveBeenCalled();
    });

    it('onPaid increments Coupon.redemptionCount when the activated Subscription used one', async () => {
      findUnique.mockResolvedValueOnce(null);
      orderFindFirst.mockResolvedValueOnce(null);
      subscriptionFindFirst.mockResolvedValueOnce({ id: 'sub_1', couponId: 'coupon_1' });
      const { POST } = await import('./route');
      const { req } = bictorysFixtureRequest({ status: 'succeeded' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(couponUpdate).toHaveBeenCalledWith({
        where: { id: 'coupon_1' },
        data: { redemptionCount: { increment: 1 } },
      });
    });

    it('onPaid falls back to paymentReference when providerChargeId no longer matches (stale attempt superseded)', async () => {
      findUnique.mockResolvedValueOnce(null);
      orderFindFirst.mockResolvedValueOnce(null);
      // Exact providerChargeId match misses — a newer checkout attempt has
      // since overwritten it — but the paymentReference embeds the stable
      // subscription id, so the late success must still land.
      subscriptionFindFirst.mockResolvedValueOnce(null);
      subscriptionFindUnique.mockResolvedValueOnce({
        id: 'clstalecuid1',
        couponId: null,
        ownerId: 'user_stale',
        planAmountFcfa: 2500,
      });
      const { POST } = await import('./route');
      const { req } = bictorysFixtureRequest({
        status: 'succeeded',
        chargeId: 'charge_old_and_superseded',
        paymentReference: 'sub_clstalecuid1_deadbeef1234',
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(subscriptionFindUnique).toHaveBeenCalledWith({ where: { id: 'clstalecuid1' } });
      expect(subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'clstalecuid1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            providerChargeId: 'charge_old_and_superseded',
          }),
        }),
      );
    });

    it('onFailed marks a Subscription FAILED found by providerChargeId', async () => {
      findUnique.mockResolvedValueOnce(null);
      orderFindFirst.mockResolvedValueOnce(null);
      subscriptionFindFirst.mockResolvedValueOnce({
        id: 'sub_2',
        ownerId: 'user_2',
        planAmountFcfa: 2500,
      });
      const { POST } = await import('./route');
      const { req } = bictorysFixtureRequest({ status: 'failed' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub_2' }, data: { status: 'FAILED' } }),
      );
      expect(subscriptionPaymentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionId: 'sub_2',
          ownerId: 'user_2',
          status: 'FAILED',
        }),
      });
    });

    it('onRefunded marks a Subscription CANCELED found by providerChargeId', async () => {
      findUnique.mockResolvedValueOnce(null);
      orderFindFirst.mockResolvedValueOnce(null);
      subscriptionFindFirst.mockResolvedValueOnce({
        id: 'sub_3',
        ownerId: 'user_3',
        planAmountFcfa: 2500,
        owner: { email: 'shop3@example.com' },
      });
      const { POST } = await import('./route');
      const { req } = bictorysFixtureRequest({ status: 'refunded' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub_3' }, data: { status: 'CANCELED' } }),
      );
      // Refunds ledger as FAILED — see onRefunded's comment in route.ts.
      expect(subscriptionPaymentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionId: 'sub_3',
          ownerId: 'user_3',
          status: 'FAILED',
        }),
      });
      // Audit fix — refund confirmation email so the subscriber isn't just
      // silently dropped to the free tier.
      expect(outboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'email.refund_confirmation',
            payload: expect.objectContaining({
              to: 'shop3@example.com',
              planAmountFcfa: 2500,
            }),
          }),
        }),
      );
    });

    it('onRefunded skips the confirmation email for a synthetic phone-signup placeholder', async () => {
      findUnique.mockResolvedValueOnce(null);
      orderFindFirst.mockResolvedValueOnce(null);
      subscriptionFindFirst.mockResolvedValueOnce({
        id: 'sub_4',
        ownerId: 'user_4',
        planAmountFcfa: 2500,
        owner: { email: '221771234567@phone.jurali.local' },
      });
      const { POST } = await import('./route');
      const { req } = bictorysFixtureRequest({ status: 'refunded' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(outboxCreate).not.toHaveBeenCalled();
    });

    it('unknown charge (neither Order nor Subscription) drops silently — 200', async () => {
      findUnique.mockResolvedValueOnce(null);
      orderFindFirst.mockResolvedValueOnce(null);
      subscriptionFindFirst.mockResolvedValueOnce(null);
      const { POST } = await import('./route');
      const { req } = bictorysFixtureRequest({ status: 'succeeded' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(subscriptionUpdate).not.toHaveBeenCalled();
      expect(subscriptionPaymentCreate).not.toHaveBeenCalled();
    });
  });
});
