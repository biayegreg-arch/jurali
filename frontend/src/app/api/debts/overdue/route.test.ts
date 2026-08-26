// GET /api/debts/overdue — Banani's "Dettes en retard" desktop screen.
// Free-tier accessible (see route.ts comment) — no subscription mocking
// needed, unlike /api/stats.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/debts/overdue');
}

const day = (offsetDays: number) => new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);

function client(
  over: Partial<{
    id: string;
    firstName: string;
    phone: string | null;
    transactions: {
      id: string;
      type: string;
      amountFcfa: number;
      note: string | null;
      createdAt: Date;
    }[];
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
  prismaMock.client.findMany.mockResolvedValue([]);
});

describe('GET /api/debts/overdue', () => {
  it('401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }) as never,
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('returns an empty result set when nothing is overdue', async () => {
    const res = await GET(makeGet());
    const json = (await res.json()) as { items: unknown[]; totalOverdueFcfa: number };
    expect(json.items).toEqual([]);
    expect(json.totalOverdueFcfa).toBe(0);
  });

  it('flattens overdue debts across clients into one row per debt', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c1',
        firstName: 'Fatou',
        phone: '+221771112233',
        transactions: [
          { id: 'd1', type: 'DEBT', amountFcfa: 19_500, note: 'Riz 10kg', createdAt: day(102) },
        ],
      }),
      client({
        id: 'c2',
        firstName: 'Moussa',
        phone: null,
        transactions: [
          { id: 'd2', type: 'DEBT', amountFcfa: 3_800, note: null, createdAt: day(5) },
        ],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as {
      items: { id: string; clientId: string; clientName: string; amountFcfa: number }[];
    };
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toMatchObject({
      id: 'd1',
      clientId: 'c1',
      clientName: 'Fatou',
      clientPhone: '+221771112233',
      amountFcfa: 19_500,
      note: 'Riz 10kg',
    });
  });

  it('sorts rows by days overdue, most urgent first', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c1',
        transactions: [
          { id: 'd1', type: 'DEBT', amountFcfa: 1_000, note: null, createdAt: day(35) },
        ],
      }),
      client({
        id: 'c2',
        transactions: [
          { id: 'd2', type: 'DEBT', amountFcfa: 1_000, note: null, createdAt: day(120) },
        ],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { items: { id: string }[] };
    expect(json.items.map((i) => i.id)).toEqual(['d2', 'd1']);
  });

  it('lists multiple overdue debts for the same client separately', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c1',
        transactions: [
          { id: 'd1', type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: day(90) },
          { id: 'd2', type: 'DEBT', amountFcfa: 3_000, note: null, createdAt: day(60) },
        ],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { items: unknown[]; affectedClientCount: number };
    expect(json.items).toHaveLength(2);
    expect(json.affectedClientCount).toBe(1);
  });

  it('sums totalOverdueFcfa and averages daysOverdue across all rows', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c1',
        transactions: [
          { id: 'd1', type: 'DEBT', amountFcfa: 10_000, note: null, createdAt: day(100) },
        ],
      }),
      client({
        id: 'c2',
        transactions: [
          { id: 'd2', type: 'DEBT', amountFcfa: 20_000, note: null, createdAt: day(150) },
        ],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { totalOverdueFcfa: number; averageDaysOverdue: number };
    expect(json.totalOverdueFcfa).toBe(30_000);
    expect(json.averageDaysOverdue).toBe(125);
  });

  it('returns totalClientCount as every client the owner has, not just affected ones', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({ id: 'c1', transactions: [] }),
      client({
        id: 'c2',
        transactions: [
          { id: 'd1', type: 'DEBT', amountFcfa: 1_000, note: null, createdAt: day(90) },
        ],
      }),
      client({ id: 'c3', transactions: [] }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { totalClientCount: number; affectedClientCount: number };
    expect(json.totalClientCount).toBe(3);
    expect(json.affectedClientCount).toBe(1);
  });

  it('excludes a fresh (non-overdue) debt from the list', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c1',
        transactions: [
          { id: 'd1', type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: day(2) },
        ],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as { items: unknown[] };
    expect(json.items).toEqual([]);
  });
});
