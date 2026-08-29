// GET/PATCH /api/admin/config — admin-editable Premium price.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
  requireSuperadmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return {
    ...actual,
    verifyCsrf: vi.fn(),
  };
});
vi.mock('@/lib/server/admin/audit', () => ({
  logAdminAction: vi.fn(),
}));

import { requireAdmin, requireSuperadmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { verifyCsrf } from '@/lib/server/auth';
import { logAdminAction } from '@/lib/server/admin/audit';
import { seedAdmin, seedSuperadmin } from '@/test-utils/admin-fixtures';
import { GET, PATCH } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);

const admin = seedAdmin();
const adminCtx = {
  user: { sub: admin.id, email: admin.email },
  admin: { id: admin.id, email: admin.email, role: 'ADMIN' as const },
};
const superadmin = seedSuperadmin();
const superadminCtx = {
  user: { sub: superadmin.id, email: superadmin.email },
  admin: { id: superadmin.id, email: superadmin.email, role: 'SUPERADMIN' as const },
};

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://test/api/admin/config', {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRequireSuperadmin.mockResolvedValue(superadminCtx);
  mockRateLimit.mockResolvedValue(null);
  mockVerifyCsrf.mockReturnValue(null);
});

describe('GET /api/admin/config', () => {
  it('returns the hardcoded default when no PlatformConfig row exists', async () => {
    prismaMock.platformConfig.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      premiumMonthlyPriceFcfa: number;
      updatedAt: string | null;
    };
    expect(body.premiumMonthlyPriceFcfa).toBe(2500);
    expect(body.updatedAt).toBeNull();
  });

  it('returns the admin-set price when a PlatformConfig row exists', async () => {
    prismaMock.platformConfig.findUnique.mockResolvedValue({
      id: 'singleton',
      premiumMonthlyPriceFcfa: 3000,
      updatedAt: new Date('2026-08-29T00:00:00Z'),
    });
    const res = await GET(makeReq('GET'));
    const body = (await res.json()) as { premiumMonthlyPriceFcfa: number };
    expect(body.premiumMonthlyPriceFcfa).toBe(3000);
  });

  it('an ADMIN (not just SUPERADMIN) can read the price', async () => {
    prismaMock.platformConfig.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    expect(mockRequireAdmin).toHaveBeenCalledWith('ADMIN');
  });
});

describe('PATCH /api/admin/config', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((cb: unknown) => {
      if (typeof cb === 'function') {
        return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
      }
      return Promise.resolve(cb);
    });
  });

  it('requires SUPERADMIN, not just ADMIN', async () => {
    // requireAdmin() is never called by PATCH — only requireSuperadmin() is.
    prismaMock.platformConfig.findUnique.mockResolvedValue(null);
    prismaMock.platformConfig.upsert.mockResolvedValue({
      id: 'singleton',
      premiumMonthlyPriceFcfa: 3000,
      updatedAt: new Date('2026-08-29T00:00:00Z'),
    });
    await PATCH(makeReq('PATCH', { premiumMonthlyPriceFcfa: 3000 }));
    expect(mockRequireSuperadmin).toHaveBeenCalled();
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it('rejects CSRF failures before touching the DB', async () => {
    const csrfResponse = new Response(null, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockVerifyCsrf.mockReturnValue(csrfResponse as any);
    const res = await PATCH(makeReq('PATCH', { premiumMonthlyPriceFcfa: 3000 }));
    expect(res.status).toBe(403);
    expect(prismaMock.platformConfig.upsert).not.toHaveBeenCalled();
  });

  it('rejects a price below the minimum bound', async () => {
    const res = await PATCH(makeReq('PATCH', { premiumMonthlyPriceFcfa: 50 }));
    expect(res.status).toBe(400);
    expect(prismaMock.platformConfig.upsert).not.toHaveBeenCalled();
  });

  it('rejects a price above the maximum bound', async () => {
    const res = await PATCH(makeReq('PATCH', { premiumMonthlyPriceFcfa: 500_000 }));
    expect(res.status).toBe(400);
    expect(prismaMock.platformConfig.upsert).not.toHaveBeenCalled();
  });

  it('rejects a non-integer price', async () => {
    const res = await PATCH(makeReq('PATCH', { premiumMonthlyPriceFcfa: 2500.5 }));
    expect(res.status).toBe(400);
  });

  it('upserts the singleton row and logs the admin action with from/to', async () => {
    prismaMock.platformConfig.findUnique.mockResolvedValue({
      id: 'singleton',
      premiumMonthlyPriceFcfa: 2500,
      updatedAt: new Date('2026-08-01T00:00:00Z'),
    });
    prismaMock.platformConfig.upsert.mockResolvedValue({
      id: 'singleton',
      premiumMonthlyPriceFcfa: 3000,
      updatedAt: new Date('2026-08-29T00:00:00Z'),
    });

    const res = await PATCH(makeReq('PATCH', { premiumMonthlyPriceFcfa: 3000 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { premiumMonthlyPriceFcfa: number };
    expect(body.premiumMonthlyPriceFcfa).toBe(3000);

    expect(prismaMock.platformConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'singleton' },
        create: { id: 'singleton', premiumMonthlyPriceFcfa: 3000 },
        update: { premiumMonthlyPriceFcfa: 3000 },
      }),
    );
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: superadmin.id,
        action: 'platform_config.price_change',
        targetType: 'PlatformConfig',
        targetId: 'singleton',
        metadata: { from: 2500, to: 3000 },
      }),
    );
  });

  it('logs from=default (2500) when no row existed yet', async () => {
    prismaMock.platformConfig.findUnique.mockResolvedValue(null);
    prismaMock.platformConfig.upsert.mockResolvedValue({
      id: 'singleton',
      premiumMonthlyPriceFcfa: 5000,
      updatedAt: new Date('2026-08-29T00:00:00Z'),
    });

    await PATCH(makeReq('PATCH', { premiumMonthlyPriceFcfa: 5000 }));

    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: { from: 2500, to: 5000 } }),
    );
  });
});
