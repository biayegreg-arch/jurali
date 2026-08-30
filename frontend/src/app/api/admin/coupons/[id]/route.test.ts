// PATCH /api/admin/coupons/[id] — toggle a coupon active/inactive.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
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

import { requireSuperadmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { verifyCsrf } from '@/lib/server/auth';
import { logAdminAction } from '@/lib/server/admin/audit';
import { seedSuperadmin } from '@/test-utils/admin-fixtures';
import { PATCH } from './route';

const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);

const superadmin = seedSuperadmin();
const superadminCtx = {
  user: { sub: superadmin.id, email: superadmin.email },
  admin: { id: superadmin.id, email: superadmin.email, role: 'SUPERADMIN' as const },
};

function makeReq(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://test/api/admin/coupons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
function paramsOf(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe('PATCH /api/admin/coupons/[id]', () => {
  it('rejects CSRF failures before touching the DB', async () => {
    const csrfResponse = new Response(null, { status: 403 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockVerifyCsrf.mockReturnValue(csrfResponse as any);
    const res = await PATCH(makeReq('c1', { active: false }), paramsOf('c1'));
    expect(res.status).toBe(403);
    expect(prismaMock.coupon.update).not.toHaveBeenCalled();
  });

  it('requires SUPERADMIN', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await PATCH(makeReq('c1', { active: false }), paramsOf('c1'));
    expect(res.status).toBe(403);
    expect(prismaMock.coupon.findUnique).not.toHaveBeenCalled();
  });

  it('404s for a missing coupon', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq('missing', { active: false }), paramsOf('missing'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('COUPON_NOT_FOUND');
  });

  it('deactivates an active coupon and logs coupon.deactivate', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      active: true,
    } as never);
    prismaMock.coupon.update.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      active: false,
    } as never);

    const res = await PATCH(makeReq('c1', { active: false }), paramsOf('c1'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { coupon: { active: boolean } };
    expect(body.coupon.active).toBe(false);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: superadmin.id,
        action: 'coupon.deactivate',
        targetType: 'Coupon',
        targetId: 'c1',
        metadata: { code: 'SUMMER20' },
      }),
    );
  });

  it('reactivates a coupon and logs coupon.activate', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      active: false,
    } as never);
    prismaMock.coupon.update.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      active: true,
    } as never);

    const res = await PATCH(makeReq('c1', { active: true }), paramsOf('c1'));

    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'coupon.activate' }),
    );
  });

  it('is idempotent when the state is unchanged (no AdminAction written)', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      active: true,
    } as never);

    const res = await PATCH(makeReq('c1', { active: true }), paramsOf('c1'));

    expect(res.status).toBe(200);
    expect(prismaMock.coupon.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });
});
