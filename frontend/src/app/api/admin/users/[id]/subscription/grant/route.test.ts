// POST /api/admin/users/[id]/subscription/grant — admin-forced Premium grant.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

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
import { POST } from './route';

const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLogAdminAction = vi.mocked(logAdminAction);

const superadmin = seedSuperadmin();
const superadminCtx = {
  user: { sub: superadmin.id, email: superadmin.email },
  admin: { id: superadmin.id, email: superadmin.email, role: 'SUPERADMIN' as const },
};

function makeReq(id: string): NextRequest {
  return new NextRequest(`http://test/api/admin/users/${id}/subscription/grant`, {
    method: 'POST',
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

describe('POST /api/admin/users/[id]/subscription/grant', () => {
  it('grants Premium to a user with no existing subscription and logs subscription.admin_grant', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as never);
    prismaMock.subscription.findUnique.mockResolvedValueOnce(null);
    prismaMock.subscription.upsert.mockResolvedValueOnce({
      id: 'sub_1',
      ownerId: 'u1',
      status: 'ACTIVE',
      renewsAt: new Date('2026-10-15T00:00:00Z'),
    } as never);

    const res = await POST(makeReq('u1'), paramsOf('u1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subscription: { status: string } };
    expect(body.subscription.status).toBe('ACTIVE');
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'u1' },
        create: expect.objectContaining({ ownerId: 'u1', status: 'ACTIVE', planAmountFcfa: 0 }),
        update: expect.objectContaining({ status: 'ACTIVE', planAmountFcfa: 0 }),
      }),
    );
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: superadmin.id,
        action: 'subscription.admin_grant',
        targetType: 'Subscription',
        targetId: 'sub_1',
        metadata: expect.objectContaining({ ownerId: 'u1', from: 'NONE', to: 'ACTIVE' }),
      }),
    );
  });

  it('re-activates a CANCELED subscription for the same owner (upsert update branch)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2' } as never);
    prismaMock.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_2',
      ownerId: 'u2',
      status: 'CANCELED',
    } as never);
    prismaMock.subscription.upsert.mockResolvedValueOnce({
      id: 'sub_2',
      ownerId: 'u2',
      status: 'ACTIVE',
      renewsAt: new Date('2026-10-15T00:00:00Z'),
    } as never);

    const res = await POST(makeReq('u2'), paramsOf('u2'));
    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ from: 'CANCELED', to: 'ACTIVE' }),
      }),
    );
  });

  it('404s when the target user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeReq('missing'), paramsOf('missing'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('USER_NOT_FOUND');
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it('requires SUPERADMIN', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await POST(makeReq('u1'), paramsOf('u1'));
    expect(res.status).toBe(403);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when CSRF fails', async () => {
    mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF' }, { status: 403 }));
    const res = await POST(makeReq('u1'), paramsOf('u1'));
    expect(res.status).toBe(403);
    expect(mockRequireSuperadmin).not.toHaveBeenCalled();
  });
});
