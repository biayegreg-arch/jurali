import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRecentSubscriptionPayments,
  getMonthlyRevenue,
  bucketMonthlyRevenue,
} from './admin-revenue';

function webhookLog(overrides: {
  id?: string;
  createdAt?: Date;
  status?: string;
  chargeId?: string;
}) {
  return {
    id: overrides.id ?? 'wh_1',
    createdAt: overrides.createdAt ?? new Date('2026-08-15T00:00:00Z'),
    payload: { status: overrides.status ?? 'succeeded', charge_id: overrides.chargeId ?? 'ch_1' },
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('getRecentSubscriptionPayments', () => {
  it('correlates a paid webhook to its Subscription via providerChargeId', async () => {
    prismaMock.webhookLog.findMany.mockResolvedValueOnce([
      webhookLog({ id: 'wh_1', chargeId: 'ch_1', status: 'succeeded' }),
    ] as never);
    prismaMock.subscription.findFirst.mockResolvedValueOnce({
      planAmountFcfa: 2500,
      owner: { email: 'a@test.local', shopName: 'Boutique A' },
    } as never);

    const events = await getRecentSubscriptionPayments(prismaMock, 10);
    expect(events).toEqual([
      {
        id: 'wh_1',
        createdAt: new Date('2026-08-15T00:00:00Z'),
        status: 'PAID',
        amountFcfa: 2500,
        ownerEmail: 'a@test.local',
        ownerShopName: 'Boutique A',
      },
    ]);
  });

  it('classifies failed/cancelled/refunded statuses as FAILED', async () => {
    for (const status of ['failed', 'cancelled', 'refunded']) {
      prismaMock.webhookLog.findMany.mockResolvedValueOnce([
        webhookLog({ status, chargeId: 'ch_x' }),
      ] as never);
      prismaMock.subscription.findFirst.mockResolvedValueOnce({
        planAmountFcfa: 2500,
        owner: { email: 'x@test.local', shopName: null },
      } as never);
      const events = await getRecentSubscriptionPayments(prismaMock, 10);
      expect(events[0]?.status).toBe('FAILED');
    }
  });

  it('drops pending/unknown-status webhooks (not a terminal event)', async () => {
    prismaMock.webhookLog.findMany.mockResolvedValueOnce([
      webhookLog({ status: 'pending' }),
    ] as never);
    const events = await getRecentSubscriptionPayments(prismaMock, 10);
    expect(events).toEqual([]);
    expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('skips a webhook with no matching Subscription (e.g. an Order charge)', async () => {
    prismaMock.webhookLog.findMany.mockResolvedValueOnce([
      webhookLog({ status: 'succeeded', chargeId: 'ch_order' }),
    ] as never);
    prismaMock.subscription.findFirst.mockResolvedValueOnce(null);
    const events = await getRecentSubscriptionPayments(prismaMock, 10);
    expect(events).toEqual([]);
  });

  it('stops once `limit` correlated events are collected', async () => {
    prismaMock.webhookLog.findMany.mockResolvedValueOnce([
      webhookLog({ id: 'wh_1', chargeId: 'ch_1' }),
      webhookLog({ id: 'wh_2', chargeId: 'ch_2' }),
      webhookLog({ id: 'wh_3', chargeId: 'ch_3' }),
    ] as never);
    prismaMock.subscription.findFirst.mockResolvedValue({
      planAmountFcfa: 2500,
      owner: { email: 'a@test.local', shopName: null },
    } as never);
    const events = await getRecentSubscriptionPayments(prismaMock, 2);
    expect(events).toHaveLength(2);
    expect(prismaMock.subscription.findFirst).toHaveBeenCalledTimes(2);
  });
});

describe('getMonthlyRevenue', () => {
  it('sums PAID events into their calendar month and zero-fills months with no activity', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T12:00:00Z'));

    prismaMock.webhookLog.findMany.mockResolvedValueOnce([
      webhookLog({
        id: 'wh_1',
        chargeId: 'ch_1',
        status: 'succeeded',
        createdAt: new Date('2026-08-10T00:00:00Z'),
      }),
      webhookLog({
        id: 'wh_2',
        chargeId: 'ch_2',
        status: 'succeeded',
        createdAt: new Date('2026-08-20T00:00:00Z'),
      }),
      webhookLog({
        id: 'wh_3',
        chargeId: 'ch_3',
        status: 'failed',
        createdAt: new Date('2026-07-05T00:00:00Z'),
      }),
    ] as never);
    prismaMock.subscription.findFirst.mockResolvedValue({
      planAmountFcfa: 2500,
      owner: { email: 'a@test.local', shopName: null },
    } as never);

    const points = await getMonthlyRevenue(prismaMock, 3);
    expect(points).toEqual([
      { month: '2026-06', totalFcfa: 0 },
      { month: '2026-07', totalFcfa: 0 }, // the July event was FAILED — excluded
      { month: '2026-08', totalFcfa: 5000 },
    ]);
    vi.useRealTimers();
  });
});

describe('bucketMonthlyRevenue (pure)', () => {
  it('lets a single fetched event list feed both the chart and a recent-events slice', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T12:00:00Z'));

    const events = [
      {
        id: 'wh_1',
        createdAt: new Date('2026-08-10T00:00:00Z'),
        status: 'PAID' as const,
        amountFcfa: 2500,
        ownerEmail: 'a@test.local',
        ownerShopName: null,
      },
    ];
    const points = bucketMonthlyRevenue(events, 2);
    expect(points).toEqual([
      { month: '2026-07', totalFcfa: 0 },
      { month: '2026-08', totalFcfa: 2500 },
    ]);
    vi.useRealTimers();
  });
});
