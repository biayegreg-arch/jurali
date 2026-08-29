// POST /api/admin/users/[id]/subscription/cancel — admin-forced Premium cancel.
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
  return new NextRequest(`http://test/api/admin/users/${id}/subscription/cancel`, {
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

describe('POST /api/admin/users/[id]/subscription/cancel', () => {
  it('cancels an ACTIVE subscription and logs subscription.admin_cancel', async () => {
    prismaMock.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_1',
      ownerId: 'u1',
      status: 'ACTIVE',
    } as never);
    prismaMock.subscription.update.mockResolvedValueOnce({
      id: 'sub_1',
      ownerId: 'u1',
      status: 'CANCELED',
    } as never);

    const res = await POST(makeReq('u1'), paramsOf('u1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subscription: { status: string } };
    expect(body.subscription.status).toBe('CANCELED');
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: superadmin.id,
        action: 'subscription.admin_cancel',
        targetType: 'Subscription',
        targetId: 'sub_1',
        metadata: { ownerId: 'u1', from: 'ACTIVE', to: 'CANCELED' },
      }),
    );
  });

  it('is idempotent for an already-CANCELED subscription (no duplicate AdminAction)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_2',
      ownerId: 'u2',
      status: 'CANCELED',
    } as never);

    const res = await POST(makeReq('u2'), paramsOf('u2'));
    expect(res.status).toBe(200);
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('404s when the user has no subscription', async () => {
    prismaMock.subscription.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeReq('u3'), paramsOf('u3'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('SUBSCRIPTION_NOT_FOUND');
  });

  it('requires SUPERADMIN', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await POST(makeReq('u1'), paramsOf('u1'));
    expect(res.status).toBe(403);
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when CSRF fails', async () => {
    mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF' }, { status: 403 }));
    const res = await POST(makeReq('u1'), paramsOf('u1'));
    expect(res.status).toBe(403);
    expect(mockRequireSuperadmin).not.toHaveBeenCalled();
  });
});
