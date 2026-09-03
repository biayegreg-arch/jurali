// GET /api/admin/overview — Vue d'ensemble admin dashboard KPIs.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { seedAdmin } from '@/test-utils/admin-fixtures';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);

const admin = seedAdmin();
const adminCtx = {
  user: { sub: admin.id, email: admin.email },
  admin: { id: admin.id, email: admin.email, role: 'ADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/overview', { method: 'GET' });
}

function defaultMocks(): void {
  prismaMock.user.count.mockResolvedValue(100);
  prismaMock.subscription.aggregate.mockResolvedValue({
    _count: { _all: 25 },
    _sum: { planAmountFcfa: 62_500 },
  } as never);
  prismaMock.platformConfig.findUnique.mockResolvedValue(null);
  prismaMock.user.findMany.mockResolvedValue([] as never);
  prismaMock.subscriptionPayment.findMany.mockResolvedValue([] as never);
  prismaMock.subscription.findUnique.mockResolvedValue(null);
  prismaMock.client.count.mockResolvedValue(0);
  prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: null } } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  defaultMocks();
});

describe('GET /api/admin/overview', () => {
  it('computes KPIs from real aggregates (mrr = sum of active planAmountFcfa, not count*price)', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kpis: {
        totalUsers: number;
        premiumCount: number;
        freeCount: number;
        mrrFcfa: number;
        conversionRate: number;
        premiumMonthlyPriceFcfa: number;
      };
    };
    expect(body.kpis).toEqual({
      totalUsers: 100,
      premiumCount: 25,
      freeCount: 75,
      mrrFcfa: 62_500,
      conversionRate: 0.25,
      premiumMonthlyPriceFcfa: 2500,
    });
  });

  it('conversionRate is 0 (not NaN) when there are zero users', async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.subscription.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { planAmountFcfa: null },
    } as never);
    const res = await GET(makeGet());
    const body = (await res.json()) as { kpis: { conversionRate: number; mrrFcfa: number } };
    expect(body.kpis.conversionRate).toBe(0);
    expect(body.kpis.mrrFcfa).toBe(0);
  });

  it('enriches recentUsers with isPremium/clientCount/outstandingBalanceFcfa', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@test.local',
        name: null,
        shopName: 'Boutique A',
        createdAt: new Date('2026-08-20T00:00:00Z'),
      },
    ] as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      renewsAt: new Date('2099-01-01T00:00:00Z'),
    } as never);
    prismaMock.client.count.mockResolvedValue(7);
    prismaMock.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amountFcfa: 50_000 } } as never) // DEBT
      .mockResolvedValueOnce({ _sum: { amountFcfa: 20_000 } } as never); // PAYMENT

    const res = await GET(makeGet());
    const body = (await res.json()) as {
      recentUsers: Array<{
        id: string;
        isPremium: boolean;
        clientCount: number;
        outstandingBalanceFcfa: number;
      }>;
    };
    expect(body.recentUsers[0]).toMatchObject({
      id: 'u1',
      isPremium: true,
      clientCount: 7,
      outstandingBalanceFcfa: 30_000,
    });
  });

  it('a lapsed ACTIVE-status subscription reports isPremium=false for the recent-user badge', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@test.local', name: null, shopName: null, createdAt: new Date() },
    ] as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      renewsAt: new Date('2000-01-01T00:00:00Z'),
    } as never);

    const res = await GET(makeGet());
    const body = (await res.json()) as { recentUsers: Array<{ isPremium: boolean }> };
    expect(body.recentUsers[0]?.isPremium).toBe(false);
  });

  it('does NOT clamp a net-negative outstanding balance (a real data anomaly, not a display bug)', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@test.local', name: null, shopName: null, createdAt: new Date() },
    ] as never);
    prismaMock.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amountFcfa: 1000 } } as never) // DEBT
      .mockResolvedValueOnce({ _sum: { amountFcfa: 5000 } } as never); // PAYMENT
    const res = await GET(makeGet());
    const body = (await res.json()) as { recentUsers: Array<{ outstandingBalanceFcfa: number }> };
    expect(body.recentUsers[0]?.outstandingBalanceFcfa).toBe(-4000);
  });

  it('propagates 403 from requireAdmin without querying anything', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });
});
