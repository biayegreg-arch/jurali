// Jurali Phase 8 — POST /api/clients/[id]/remind tests.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makePost(
  id: string,
  csrf: 'match' | 'missing' = 'match',
): { req: NextRequest; routeCtx: { params: Promise<{ id: string }> } } {
  const headers: Record<string, string> = {};
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return {
    req: new NextRequest(`http://test/api/clients/${id}/remind`, { method: 'POST', headers }),
    routeCtx: { params: Promise.resolve({ id }) },
  };
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

function client(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'client-1',
    ownerId: 'user-1',
    firstName: 'Awa',
    phone: '+221771234567',
    transactions: [{ type: 'DEBT', amountFcfa: 12_500 }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
  prismaMock.subscription.findUnique.mockResolvedValue(activeSubscription() as never);
  prismaMock.client.findUnique.mockResolvedValue(client() as never);
  prismaMock.user.findUnique.mockResolvedValue({ shopName: 'Boutique Awa' } as never);
  prismaMock.client.update.mockResolvedValue({ lastReminderSentAt: new Date() } as never);
});

describe('POST /api/clients/[id]/remind', () => {
  it('403 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) as never,
    );
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(401);
  });

  it('403 when CSRF token is missing', async () => {
    const { req, routeCtx } = makePost('client-1', 'missing');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(403);
  });

  it('403 PREMIUM_REQUIRED for a free-tier user (no active subscription)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('PREMIUM_REQUIRED');
    expect(prismaMock.client.findUnique).not.toHaveBeenCalled();
  });

  it('404 CLIENT_NOT_FOUND when the client does not exist', async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    const { req, routeCtx } = makePost('missing');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(404);
  });

  it('404 (not 403) when the client belongs to a different owner', async () => {
    prismaMock.client.findUnique.mockResolvedValue(client({ ownerId: 'someone-else' }) as never);
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(404);
  });

  it('409 CLIENT_NO_PHONE when the client has no registered phone', async () => {
    prismaMock.client.findUnique.mockResolvedValue(client({ phone: null }) as never);
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('CLIENT_NO_PHONE');
  });

  it('409 NOTHING_OWED when the client balance is 0', async () => {
    prismaMock.client.findUnique.mockResolvedValue(client({ transactions: [] }) as never);
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('NOTHING_OWED');
  });

  it('409 NOTHING_OWED when the balance was fully paid off', async () => {
    prismaMock.client.findUnique.mockResolvedValue(
      client({
        transactions: [
          { type: 'DEBT', amountFcfa: 10_000 },
          { type: 'PAYMENT', amountFcfa: 10_000 },
        ],
      }) as never,
    );
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(409);
  });

  it('200: builds the wa.me URL, includes shop name + amount, and stamps lastReminderSentAt', async () => {
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('https://wa.me/221771234567?text=');
    const decoded = decodeURIComponent(body.url.split('?text=')[1]);
    expect(decoded).toContain('Awa');
    expect(decoded).toContain('12 500');
    expect(decoded).toContain('Boutique Awa');
    expect(body.lastReminderSentAt).toBeTruthy();
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'client-1' },
        data: { lastReminderSentAt: expect.any(Date) },
      }),
    );
  });

  it('falls back to a generic shop reference when the owner has no shopName', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ shopName: null } as never);
    const { req, routeCtx } = makePost('client-1');
    const res = await POST(req, routeCtx);
    const body = await res.json();
    const decoded = decodeURIComponent(body.url.split('?text=')[1]);
    expect(decoded).toContain('la boutique');
  });
});
