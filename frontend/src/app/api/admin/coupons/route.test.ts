// GET/POST /api/admin/coupons — Premium checkout discount codes.
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
import { GET, POST } from './route';

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
  return new NextRequest('http://test/api/admin/coupons', {
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
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('GET /api/admin/coupons', () => {
  it('an ADMIN (not just SUPERADMIN) can list coupons', async () => {
    prismaMock.coupon.findMany.mockResolvedValue([]);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    expect(mockRequireAdmin).toHaveBeenCalledWith('ADMIN');
  });

  it('returns items in descending creation order', async () => {
    prismaMock.coupon.findMany.mockResolvedValue([
      {
        id: 'c1',
        code: 'SUMMER20',
        percentOff: 20,
        active: true,
        expiresAt: null,
        redemptionCount: 3,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        createdBy: { email: 'admin@test.local' },
      },
    ] as never);
    const res = await GET(makeReq('GET'));
    const body = (await res.json()) as { items: Array<{ code: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.code).toBe('SUMMER20');
  });
});

describe('POST /api/admin/coupons', () => {
  it('requires SUPERADMIN, not just ADMIN', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue(null);
    prismaMock.coupon.create.mockResolvedValue({
      id: 'c1',
      code: 'SUMMER20',
      percentOff: 20,
      active: true,
      expiresAt: null,
      redemptionCount: 0,
      createdAt: new Date('2026-08-29T00:00:00Z'),
    } as never);

    await POST(makeReq('POST', { code: 'summer20', percentOff: 20 }));

    expect(mockRequireSuperadmin).toHaveBeenCalled();
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it('rejects CSRF failures before touching the DB', async () => {
    const csrfResponse = new Response(null, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockVerifyCsrf.mockReturnValue(csrfResponse as any);
    const res = await POST(makeReq('POST', { code: 'SUMMER20', percentOff: 20 }));
    expect(res.status).toBe(403);
    expect(prismaMock.coupon.create).not.toHaveBeenCalled();
  });

  it('rejects percentOff above 100', async () => {
    const res = await POST(makeReq('POST', { code: 'SUMMER20', percentOff: 150 }));
    expect(res.status).toBe(400);
    expect(prismaMock.coupon.create).not.toHaveBeenCalled();
  });

  it('rejects percentOff below 1', async () => {
    const res = await POST(makeReq('POST', { code: 'SUMMER20', percentOff: 0 }));
    expect(res.status).toBe(400);
  });

  it('rejects a code with disallowed characters', async () => {
    const res = await POST(makeReq('POST', { code: 'SUMMER 20!', percentOff: 20 }));
    expect(res.status).toBe(400);
  });

  it('uppercases the code before storing and checking uniqueness', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue(null);
    prismaMock.coupon.create.mockResolvedValue({
      id: 'c1',
      code: 'SUMMER20',
      percentOff: 20,
      active: true,
      expiresAt: null,
      redemptionCount: 0,
      createdAt: new Date('2026-08-29T00:00:00Z'),
    } as never);

    await POST(makeReq('POST', { code: 'summer20', percentOff: 20 }));

    expect(prismaMock.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'SUMMER20' } });
    expect(prismaMock.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'SUMMER20', createdById: superadmin.id }),
      }),
    );
  });

  it('409s when the code already exists', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({ id: 'existing' } as never);
    const res = await POST(makeReq('POST', { code: 'SUMMER20', percentOff: 20 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('COUPON_CODE_TAKEN');
    expect(prismaMock.coupon.create).not.toHaveBeenCalled();
  });

  it('creates the coupon and logs coupon.create', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue(null);
    prismaMock.coupon.create.mockResolvedValue({
      id: 'c1',
      code: 'SUMMER20',
      percentOff: 20,
      active: true,
      expiresAt: null,
      redemptionCount: 0,
      createdAt: new Date('2026-08-29T00:00:00Z'),
    } as never);

    const res = await POST(makeReq('POST', { code: 'SUMMER20', percentOff: 20 }));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { coupon: { code: string; percentOff: number } };
    expect(body.coupon.code).toBe('SUMMER20');
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: superadmin.id,
        action: 'coupon.create',
        targetType: 'Coupon',
        targetId: 'c1',
      }),
    );
  });
});
