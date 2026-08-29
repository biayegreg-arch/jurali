// GET /api/admin/subscriptions — Abonnements admin list.
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

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

interface SubRow {
  id: string;
  ownerId: string;
  status: string;
  renewsAt: Date | null;
  planAmountFcfa: number;
  paymentMethod: string | null;
  createdAt: Date;
  owner: { email: string; name: string | null; shopName: string | null };
}

function subRow(overrides: Partial<SubRow> = {}): SubRow {
  const id = overrides.id ?? 's1';
  return {
    id,
    ownerId: overrides.ownerId ?? `owner_${id}`,
    status: overrides.status ?? 'ACTIVE',
    renewsAt: overrides.renewsAt ?? new Date('2026-09-15T00:00:00Z'),
    planAmountFcfa: overrides.planAmountFcfa ?? 2500,
    paymentMethod: overrides.paymentMethod ?? 'WAVE',
    createdAt: overrides.createdAt ?? new Date('2026-08-01T00:00:00Z'),
    owner: overrides.owner ?? { email: `${id}@test.local`, name: null, shopName: 'Boutique Test' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
});

describe('GET /api/admin/subscriptions', () => {
  it('returns paginated subscriptions with a computed isActive flag', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      subRow({ id: 's1', status: 'ACTIVE', renewsAt: new Date('2099-01-01T00:00:00Z') }),
      subRow({ id: 's2', status: 'CANCELED', renewsAt: null }),
    ] as never);

    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; isActive: boolean }> };
    expect(body.items[0]).toMatchObject({ id: 's1', isActive: true });
    expect(body.items[1]).toMatchObject({ id: 's2', isActive: false });
  });

  it('an ACTIVE-status row with a lapsed renewsAt is reported inactive (no stale badge)', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      subRow({ id: 's1', status: 'ACTIVE', renewsAt: new Date('2000-01-01T00:00:00Z') }),
    ] as never);
    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    const body = (await res.json()) as { items: Array<{ isActive: boolean }> };
    expect(body.items[0]?.isActive).toBe(false);
  });

  it('filters by ?status', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([] as never);
    await GET(makeGet('http://test/api/admin/subscriptions?status=FAILED'));
    const args = prismaMock.subscription.findMany.mock.calls[0]?.[0];
    const where = args?.where as Record<string, unknown> | undefined;
    expect(where?.['status']).toBe('FAILED');
  });

  it('filters by ?ownerId (used by the Utilisateurs "Gérer" panel)', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([] as never);
    await GET(makeGet('http://test/api/admin/subscriptions?ownerId=u1'));
    const args = prismaMock.subscription.findMany.mock.calls[0]?.[0];
    const where = args?.where as Record<string, unknown> | undefined;
    expect(where?.['ownerId']).toBe('u1');
  });

  it('includes owner email/name/shopName via select', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([] as never);
    await GET(makeGet('http://test/api/admin/subscriptions'));
    const args = prismaMock.subscription.findMany.mock.calls[0]?.[0];
    expect(args?.select).toMatchObject({
      owner: { select: { email: true, name: true, shopName: true } },
    });
  });

  it('returns empty 200 (never 404) on no rows', async () => {
    prismaMock.subscription.findMany.mockResolvedValueOnce([] as never);
    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextCursor: null });
  });

  it('propagates 403 from requireAdmin', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    expect(res.status).toBe(403);
    expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet('http://test/api/admin/subscriptions'));
    expect(res.status).toBe(429);
    expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
  });
});
