// Phase 3 tests for GET /api/dashboard — the 4 PRD 3.2/US-02 KPIs.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/dashboard');
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
  mockRequireAuth.mockResolvedValue(authedCtx);
  prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: 0 } } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/dashboard', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    prismaMock.client.findMany.mockResolvedValue([]);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('sums totalDueFcfa and debtorCount only over clients with a positive balance', async () => {
    const recent = new Date();
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c-owes',
        transactions: [{ type: 'DEBT', amountFcfa: 12_500, note: null, createdAt: recent }],
      }),
      client({
        id: 'c-settled',
        transactions: [
          { type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: recent },
          { type: 'PAYMENT', amountFcfa: 5_000, note: null, createdAt: recent },
        ],
      }),
      client({ id: 'c-never-borrowed', transactions: [] }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { totalDueFcfa: number; debtorCount: number };
    expect(json.totalDueFcfa).toBe(12_500);
    expect(json.debtorCount).toBe(1);
  });

  it('sums overdueDueFcfa and overdueDebtorCount only over overdue clients (>30 days unpaid)', async () => {
    const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const recent = new Date();
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c-overdue',
        transactions: [{ type: 'DEBT', amountFcfa: 20_000, note: null, createdAt: old }],
      }),
      client({
        id: 'c-fresh',
        transactions: [{ type: 'DEBT', amountFcfa: 3_000, note: null, createdAt: recent }],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { overdueDueFcfa: number; overdueDebtorCount: number };
    expect(json.overdueDueFcfa).toBe(20_000);
    expect(json.overdueDebtorCount).toBe(1);
  });

  it('queries recoveredThisMonthFcfa scoped to the owner, PAYMENT type, and the calendar-month start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: 45_000 } } as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { recoveredThisMonthFcfa: number };
    expect(json.recoveredThisMonthFcfa).toBe(45_000);
    expect(prismaMock.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'user-1',
          type: 'PAYMENT',
          createdAt: { gte: new Date(2026, 7, 1) },
        }),
      }),
    );
  });

  it('returns 0 for recoveredThisMonthFcfa when there are no payments this month', async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: null } } as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { recoveredThisMonthFcfa: number };
    expect(json.recoveredThisMonthFcfa).toBe(0);
  });
});
