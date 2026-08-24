import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(id: string): { req: NextRequest; routeCtx: { params: Promise<{ id: string }> } } {
  return {
    req: new NextRequest(`http://test/api/clients/${id}`),
    routeCtx: { params: Promise.resolve({ id }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/clients/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(401);
  });

  it('returns 404 CLIENT_NOT_FOUND when the client does not exist', async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    const { req, routeCtx } = makeGet('missing');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('CLIENT_NOT_FOUND');
  });

  it('returns 404 (not 403) when the client belongs to a different owner', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'someone-else',
      firstName: 'Fatou',
      phone: null,
      createdAt: new Date(),
      transactions: [],
    } as never);
    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(404);
  });

  it('returns balance, isOverdue and history most-recent-first', async () => {
    const newer = new Date('2026-08-20T10:00:00Z');
    const older = new Date('2026-08-01T10:00:00Z');
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'user-1',
      firstName: 'Fatou',
      phone: '+221771234567',
      createdAt: older,
      transactions: [
        { id: 'tx-2', type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: newer },
        { id: 'tx-1', type: 'DEBT', amountFcfa: 12_500, note: 'Riz 5kg', createdAt: older },
      ],
    } as never);

    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      balanceFcfa: number;
      transactions: { id: string }[];
    };
    expect(json.balanceFcfa).toBe(17_500);
    // most recent first, as returned by the orderBy: createdAt desc query
    expect(json.transactions.map((t) => t.id)).toEqual(['tx-2', 'tx-1']);
  });
});
