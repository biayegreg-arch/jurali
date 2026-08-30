// GET /api/admin/revenue — Revenus admin page.
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
  return new NextRequest('http://test/api/admin/revenue', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  prismaMock.subscription.aggregate.mockResolvedValue({
    _count: { _all: 10 },
    _sum: { planAmountFcfa: 25_000 },
  } as never);
  prismaMock.webhookLog.findMany.mockResolvedValue([] as never);
});

describe('GET /api/admin/revenue', () => {
  it('returns MRR + active subscription count from a real aggregate', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mrrFcfa: number; activeSubscriptionCount: number };
    expect(body.mrrFcfa).toBe(25_000);
    expect(body.activeSubscriptionCount).toBe(10);
  });

  it('splits payments into paidCount/failedCount', async () => {
    prismaMock.webhookLog.findMany.mockResolvedValueOnce([
      {
        id: 'wh_1',
        createdAt: new Date('2026-08-10T00:00:00Z'),
        payload: { status: 'succeeded', charge_id: 'ch_1' },
      },
      {
        id: 'wh_2',
        createdAt: new Date('2026-08-11T00:00:00Z'),
        payload: { status: 'failed', charge_id: 'ch_2' },
      },
    ] as never);
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      {
        providerChargeId: 'ch_1',
        planAmountFcfa: 2500,
        owner: { email: 'a@test.local', shopName: null },
      },
      {
        providerChargeId: 'ch_2',
        planAmountFcfa: 2500,
        owner: { email: 'a@test.local', shopName: null },
      },
    ] as never);

    const res = await GET(makeGet());
    const body = (await res.json()) as { paidCount: number; failedCount: number };
    expect(body.paidCount).toBe(1);
    expect(body.failedCount).toBe(1);
  });

  it('propagates 403 from requireAdmin', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.subscription.aggregate).not.toHaveBeenCalled();
  });

  it('propagates 429 from the rate limiter', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
  });
});
