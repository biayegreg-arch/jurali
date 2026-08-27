// Phase 3 tests for GET /api/dashboard — the 4 PRD 3.2/US-02 KPIs.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(month?: string): NextRequest {
  const url = month ? `http://test/api/dashboard?month=${month}` : 'http://test/api/dashboard';
  return new NextRequest(url);
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

  it('queries recoveredThisMonthFcfa scoped to the owner, PAYMENT type, and the calendar-month bounds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: 45_000 } } as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { recoveredThisMonthFcfa: number };
    expect(json.recoveredThisMonthFcfa).toBe(45_000);
    // No ?month= means the requested month IS the current month, so
    // recoveredThisMonthFcfa is served straight from that one bounded
    // query — no separate unbounded query is issued (efficiency: avoids a
    // second round-trip for the same number in the common case).
    expect(prismaMock.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'user-1',
          type: 'PAYMENT',
          createdAt: { gte: new Date(2026, 7, 1), lt: new Date(2026, 8, 1) },
        }),
      }),
    );
    expect(prismaMock.transaction.aggregate).toHaveBeenCalledTimes(2); // PAYMENT + DEBT, no 3rd query
  });

  it('returns 0 for recoveredThisMonthFcfa when there are no payments this month', async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountFcfa: null } } as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { recoveredThisMonthFcfa: number };
    expect(json.recoveredThisMonthFcfa).toBe(0);
  });
});

describe('GET /api/dashboard — month-picker (Phase 9)', () => {
  it('defaults selectedMonth to the current calendar month when no ?month= is given', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);

    const res = await GET(makeGet());
    const json = (await res.json()) as { selectedMonth: string };
    expect(json.selectedMonth).toBe('2026-08');
  });

  it('scopes selectedMonthRecoveredFcfa/selectedMonthNewDebtsFcfa to the requested ?month=, and recoveredThisMonthFcfa stays the real current month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amountFcfa: 30_000 } } as never) // selectedMonthRecoveredFcfa (March, PAYMENT)
      .mockResolvedValueOnce({ _sum: { amountFcfa: 45_000 } } as never) // selectedMonthNewDebtsFcfa (March, DEBT)
      .mockResolvedValueOnce({ _sum: { amountFcfa: 10_000 } } as never); // recoveredThisMonthFcfa (real current month, unbounded)
    prismaMock.transaction.count.mockResolvedValue(7);

    const res = await GET(makeGet('2026-03'));
    const json = (await res.json()) as {
      selectedMonth: string;
      selectedMonthRecoveredFcfa: number;
      selectedMonthNewDebtsFcfa: number;
      selectedMonthTransactionCount: number;
      recoveredThisMonthFcfa: number;
    };
    expect(json.selectedMonth).toBe('2026-03');
    expect(json.selectedMonthRecoveredFcfa).toBe(30_000);
    expect(json.selectedMonthNewDebtsFcfa).toBe(45_000);
    expect(json.selectedMonthTransactionCount).toBe(7);
    // A ?month= in the past must NOT affect recoveredThisMonthFcfa, which
    // always tracks the real current calendar month.
    expect(json.recoveredThisMonthFcfa).toBe(10_000);

    // 1st aggregate call: PAYMENT bounded to March 2026
    expect(prismaMock.transaction.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'user-1',
          type: 'PAYMENT',
          createdAt: { gte: new Date(2026, 2, 1), lt: new Date(2026, 3, 1) },
        }),
      }),
    );
    // 2nd aggregate call: DEBT bounded to March 2026
    expect(prismaMock.transaction.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'user-1',
          type: 'DEBT',
          createdAt: { gte: new Date(2026, 2, 1), lt: new Date(2026, 3, 1) },
        }),
      }),
    );
    // 3rd aggregate call: PAYMENT unbounded from the real current month's start
    expect(prismaMock.transaction.aggregate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'user-1',
          type: 'PAYMENT',
          createdAt: { gte: new Date(2026, 7, 1) },
        }),
      }),
    );
  });

  it('falls back to the current month for a malformed ?month= param', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00Z'));
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);

    const res = await GET(makeGet('garbage'));
    const json = (await res.json()) as { selectedMonth: string };
    expect(json.selectedMonth).toBe('2026-08');
  });
});
