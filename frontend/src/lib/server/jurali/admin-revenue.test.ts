import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRecentSubscriptionPayments,
  getMonthlyRevenue,
  bucketMonthlyRevenue,
} from './admin-revenue';

function payment(overrides: {
  id?: string;
  createdAt?: Date;
  status?: 'PAID' | 'FAILED';
  amountFcfa?: number;
  ownerEmail?: string;
  ownerShopName?: string | null;
}) {
  return {
    id: overrides.id ?? 'pay_1',
    createdAt: overrides.createdAt ?? new Date('2026-08-15T00:00:00Z'),
    status: overrides.status ?? 'PAID',
    amountFcfa: overrides.amountFcfa ?? 2500,
    owner: {
      email: overrides.ownerEmail ?? 'a@test.local',
      shopName: overrides.ownerShopName ?? null,
    },
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('getRecentSubscriptionPayments', () => {
  it('reads the SubscriptionPayment ledger, newest first', async () => {
    prismaMock.subscriptionPayment.findMany.mockResolvedValueOnce([
      payment({ id: 'pay_1', status: 'PAID', ownerShopName: 'Boutique A' }),
    ] as never);

    const events = await getRecentSubscriptionPayments(prismaMock, 10);
    expect(events).toEqual([
      {
        id: 'pay_1',
        createdAt: new Date('2026-08-15T00:00:00Z'),
        status: 'PAID',
        amountFcfa: 2500,
        ownerEmail: 'a@test.local',
        ownerShopName: 'Boutique A',
      },
    ]);
    expect(prismaMock.subscriptionPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 10 }),
    );
  });

  it('preserves every ledger row across renewals — no most-recent-charge-only gap', async () => {
    // Two payments for the SAME subscriber, from two different billing
    // cycles — this is exactly the case the old WebhookLog-correlation
    // approach dropped once Subscription.providerChargeId moved on to the
    // newer checkout. The ledger has one permanent row per event, so both
    // survive.
    prismaMock.subscriptionPayment.findMany.mockResolvedValueOnce([
      payment({ id: 'pay_2', createdAt: new Date('2026-08-20T00:00:00Z') }),
      payment({ id: 'pay_1', createdAt: new Date('2026-07-15T00:00:00Z') }),
    ] as never);

    const events = await getRecentSubscriptionPayments(prismaMock, 10);
    expect(events.map((e) => e.id)).toEqual(['pay_2', 'pay_1']);
  });

  it('returns an empty list when the ledger has no rows', async () => {
    prismaMock.subscriptionPayment.findMany.mockResolvedValueOnce([]);
    const events = await getRecentSubscriptionPayments(prismaMock, 10);
    expect(events).toEqual([]);
  });
});

describe('getMonthlyRevenue', () => {
  it('sums PAID events into their calendar month and zero-fills months with no activity', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T12:00:00Z'));

    prismaMock.subscriptionPayment.findMany.mockResolvedValueOnce([
      payment({ id: 'pay_1', status: 'PAID', createdAt: new Date('2026-08-10T00:00:00Z') }),
      payment({ id: 'pay_2', status: 'PAID', createdAt: new Date('2026-08-20T00:00:00Z') }),
      payment({ id: 'pay_3', status: 'FAILED', createdAt: new Date('2026-07-05T00:00:00Z') }),
    ] as never);

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
        id: 'pay_1',
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
