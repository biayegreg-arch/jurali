// Phase 2 tests for GET+POST /api/clients.
//
// Mock strategy mirrors orders/route.test.ts: prisma-mock first (auto-hoists
// vi.mock for '@/lib/server/prisma'), requireAuth mocked per-test, verifyCsrf
// runs for real against request cookie/header (no mock needed — makePost
// sets matching cookie+header like the orders test).
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET, POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(qs = ''): NextRequest {
  return new NextRequest(`http://test/api/clients${qs}`);
}

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if ((opts.csrf ?? 'match') === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/clients', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
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
    phone: '+221771234567',
    transactions: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/clients', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('computes balance, isOverdue and lastActivityAt from transactions', async () => {
    const oldDebt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    prismaMock.client.findMany.mockResolvedValue([
      client({
        transactions: [{ type: 'DEBT', amountFcfa: 12_500, note: 'Riz 5kg', createdAt: oldDebt }],
      }),
    ] as never);

    const res = await GET(makeGet());
    const json = (await res.json()) as {
      items: { balanceFcfa: number; isOverdue: boolean; lastNote: string }[];
    };
    expect(json.items).toHaveLength(1);
    expect(json.items[0]!.balanceFcfa).toBe(12_500);
    expect(json.items[0]!.isOverdue).toBe(true);
    expect(json.items[0]!.lastNote).toBe('Riz 5kg');
  });

  it('sorts by amount ascending when requested', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({
        id: 'c-big',
        transactions: [{ type: 'DEBT', amountFcfa: 20_000, note: null, createdAt: new Date() }],
      }),
      client({
        id: 'c-small',
        transactions: [{ type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: new Date() }],
      }),
    ] as never);

    const res = await GET(makeGet('?sort=amount&order=asc'));
    const json = (await res.json()) as { items: { id: string }[] };
    expect(json.items.map((i) => i.id)).toEqual(['c-small', 'c-big']);
  });

  it('scopes the query to the authenticated owner and applies q as a name/phone search', async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    await GET(makeGet('?q=fatou'));
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'user-1',
          OR: [
            { firstName: { contains: 'fatou', mode: 'insensitive' } },
            { phone: { contains: 'fatou', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('truncates to ?limit=', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      client({ id: 'c-1' }),
      client({ id: 'c-2' }),
      client({ id: 'c-3' }),
    ] as never);
    const res = await GET(makeGet('?limit=2'));
    const json = (await res.json()) as { items: unknown[] };
    expect(json.items).toHaveLength(2);
  });
});

describe('POST /api/clients', () => {
  it('returns 403 when CSRF token is missing', async () => {
    const res = await POST(makePost({ firstName: 'Fatou' }, { csrf: 'missing' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 VALIDATION_FAILED for an empty firstName', async () => {
    prismaMock.client.count.mockResolvedValue(0);
    const res = await POST(makePost({ firstName: '' }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('VALIDATION_FAILED');
  });

  it('creates a client with balanceFcfa 0 on success', async () => {
    prismaMock.client.count.mockResolvedValue(3);
    prismaMock.client.create.mockResolvedValue({
      id: 'client-new',
      firstName: 'Ousmane',
      phone: null,
      createdAt: new Date('2026-08-24T10:00:00Z'),
    } as never);

    const res = await POST(makePost({ firstName: 'Ousmane' }));
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string; balanceFcfa: number };
    expect(json.id).toBe('client-new');
    expect(json.balanceFcfa).toBe(0);
    expect(prismaMock.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'user-1', firstName: 'Ousmane' }),
      }),
    );
  });

  it('returns 409 CLIENT_LIMIT_REACHED at the free-tier cap of 10 clients', async () => {
    prismaMock.client.count.mockResolvedValue(10);
    const res = await POST(makePost({ firstName: 'Onzième Client' }));
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('CLIENT_LIMIT_REACHED');
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });
});
