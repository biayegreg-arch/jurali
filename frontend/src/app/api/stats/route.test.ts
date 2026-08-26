// Jurali Phase 9 — GET /api/stats tests (Banani's `StatisticsDesktop` screen).
// Premium-gated like POST /api/clients/[id]/remind — see
// .planning/banani/statistics.md for the confirmed decisions.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/stats');
}

function activeSubscription() {
  return {
    id: 'sub_1',
    ownerId: 'user-1',
    status: 'ACTIVE',
    renewsAt: new Date(Date.now() + 30 * 86_400_000),
    planAmountFcfa: 2500,
  };
}

function client(
  over: Partial<{
    id: string;
    firstName: string;
    phone: string | null;
    transactions: { type: string; amountFcfa: number; note: string | null; createdAt: Date }[];
  }> = {},
) {
  return {
    id: 'client-1',
    firstName: 'Fatou',
    phone: null,
    transactions: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
  prismaMock.subscription.findUnique.mockResolvedValue(activeSubscription() as never);
  prismaMock.client.findMany.mockResolvedValue([]);
  prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: 0 } } as never);
  prismaMock.transaction.findMany.mockResolvedValue([]);
});

describe('GET /api/stats', () => {
  it('401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }) as never,
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('403 PREMIUM_REQUIRED for a free-tier user (no active subscription)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('PREMIUM_REQUIRED');
    expect(prismaMock.client.findMany).not.toHaveBeenCalled();
  });

  it('403 PREMIUM_REQUIRED when the subscription has lapsed (renewsAt in the past)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...activeSubscription(),
      renewsAt: new Date(Date.now() - 1000),
    } as never);
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
  });

  it('sums totalDueFcfa/debtorCount/overdueDueFcfa/overdueDebtorCount like /api/dashboard', async () => {
    const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const recent = new Date();
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c-overdue',
        transactions: [{ type: 'DEBT', amountFcfa: 20_000, note: null, createdAt: old }],
      }),
      client({
        id: 'c-fresh',
        transactions: [{ type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: recent }],
      }),
      client({ id: 'c-settled', transactions: [] }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as {
      totalDueFcfa: number;
      debtorCount: number;
      overdueDueFcfa: number;
      overdueDebtorCount: number;
    };
    expect(json.totalDueFcfa).toBe(25_000);
    expect(json.debtorCount).toBe(2);
    expect(json.overdueDueFcfa).toBe(20_000);
    expect(json.overdueDebtorCount).toBe(1);
  });

  it('computes averageDebtFcfa as totalDueFcfa / debtorCount, rounded', async () => {
    const recent = new Date();
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c1',
        transactions: [{ type: 'DEBT', amountFcfa: 10_000, note: null, createdAt: recent }],
      }),
      client({
        id: 'c2',
        transactions: [{ type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: recent }],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { averageDebtFcfa: number };
    expect(json.averageDebtFcfa).toBe(7_500);
  });

  it('returns averageDebtFcfa 0 when there are no debtors at all', async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    const res = await GET(makeGet());
    const json = (await res.json()) as { averageDebtFcfa: number };
    expect(json.averageDebtFcfa).toBe(0);
  });

  it('queries totalPaidFcfa as the lifetime PAYMENT sum for the owner (unbounded)', async () => {
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: 45_400 } } as never);
    const res = await GET(makeGet());
    const json = (await res.json()) as { totalPaidFcfa: number };
    expect(json.totalPaidFcfa).toBe(45_400);
    expect(prismaMock.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'user-1', type: 'PAYMENT' },
        _sum: { amountFcfa: true },
      }),
    );
  });

  it('computes recoveryRatePercent from totalPaidFcfa and totalDueFcfa', async () => {
    const recent = new Date();
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c1',
        transactions: [{ type: 'DEBT', amountFcfa: 20_600, note: null, createdAt: recent }],
      }),
    ] as never);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: 45_400 } } as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { recoveryRatePercent: number };
    expect(json.recoveryRatePercent).toBe(68.8);
  });

  it('returns a 6-entry monthlyTrend, oldest month first, ending on the current month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
    const res = await GET(makeGet());
    const json = (await res.json()) as { monthlyTrend: { month: string; label: string }[] };
    expect(json.monthlyTrend).toHaveLength(6);
    expect(json.monthlyTrend[0]).toMatchObject({ month: '2026-03', label: 'Mar' });
    expect(json.monthlyTrend[5]).toMatchObject({ month: '2026-08', label: 'Août' });
    vi.useRealTimers();
  });

  it('buckets the fetched transactions into monthlyTrend by DEBT/PAYMENT', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
    prismaMock.transaction.findMany.mockResolvedValue([
      { type: 'DEBT', amountFcfa: 10_000, createdAt: new Date(2026, 7, 10) },
      { type: 'PAYMENT', amountFcfa: 4_000, createdAt: new Date(2026, 7, 15) },
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as {
      monthlyTrend: { month: string; newDebtsFcfa: number; recoveredFcfa: number }[];
    };
    const august = json.monthlyTrend.find((m) => m.month === '2026-08');
    expect(august).toMatchObject({ newDebtsFcfa: 10_000, recoveredFcfa: 4_000 });
    vi.useRealTimers();
  });
});
