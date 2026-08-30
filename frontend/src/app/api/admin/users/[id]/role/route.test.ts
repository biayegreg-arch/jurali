// ADMIN-01 (Wave 2) — PATCH /api/admin/users/[id]/role behaviour, with a
// focused regression suite for the last-SUPERADMIN guard (CF-09): it must
// scope its count to status: 'ACTIVE', matching status/route.ts's own guard
// — otherwise a SUSPENDED SUPERADMIN still counts as "available", letting
// the sole ACTIVE SUPERADMIN demote themselves and lock the console out.
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
  return new NextRequest(`http://test/api/admin/users/${id}/role`, {
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

describe('PATCH /api/admin/users/[id]/role', () => {
  it('blocks demoting the sole ACTIVE SUPERADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    } as never);
    prismaMock.user.count.mockResolvedValueOnce(1);

    const res = await PATCH(makeReq('u1', { role: 'ADMIN' }), paramsOf('u1'));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('LAST_SUPERADMIN');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: { role: 'SUPERADMIN', status: 'ACTIVE' },
    });
  });

  it('regression: blocks demoting the only ACTIVE SUPERADMIN even when a SUSPENDED SUPERADMIN also exists', async () => {
    // Two SUPERADMIN rows total (one ACTIVE, one SUSPENDED) — the unscoped
    // count() this guard used to run would see 2 and wrongly allow this,
    // leaving zero usable SUPERADMINs. count() is scoped to status: 'ACTIVE'
    // in the route, so the mock reflects what that scoped query returns: 1.
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    } as never);
    prismaMock.user.count.mockResolvedValueOnce(1);

    const res = await PATCH(makeReq('u1', { role: 'ADMIN' }), paramsOf('u1'));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('LAST_SUPERADMIN');
  });

  it('allows demoting a SUPERADMIN when another ACTIVE SUPERADMIN remains', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    } as never);
    prismaMock.user.count.mockResolvedValueOnce(2);
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u1', role: 'ADMIN' } as never);

    const res = await PATCH(makeReq('u1', { role: 'ADMIN' }), paramsOf('u1'));
    expect(res.status).toBe(200);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: superadmin.id,
        action: 'user.role_change',
        targetType: 'User',
        targetId: 'u1',
        metadata: { from: 'SUPERADMIN', to: 'ADMIN' },
      }),
    );
  });

  it('allows demoting an already-SUSPENDED SUPERADMIN without running the last-SUPERADMIN count', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u2',
      role: 'SUPERADMIN',
      status: 'SUSPENDED',
    } as never);
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u2', role: 'ADMIN' } as never);

    const res = await PATCH(makeReq('u2', { role: 'ADMIN' }), paramsOf('u2'));
    expect(res.status).toBe(200);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it('allows promoting a user to SUPERADMIN without running the last-SUPERADMIN count', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u3',
      role: 'ADMIN',
      status: 'ACTIVE',
    } as never);
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u3', role: 'SUPERADMIN' } as never);

    const res = await PATCH(makeReq('u3', { role: 'SUPERADMIN' }), paramsOf('u3'));
    expect(res.status).toBe(200);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it('404s for a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq('missing', { role: 'ADMIN' }), paramsOf('missing'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('USER_NOT_FOUND');
  });

  it('rejects an invalid role value', async () => {
    const res = await PATCH(makeReq('u1', { role: 'OWNER' }), paramsOf('u1'));
    expect(res.status).toBe(400);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('requires SUPERADMIN', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await PATCH(makeReq('u1', { role: 'ADMIN' }), paramsOf('u1'));
    expect(res.status).toBe(403);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when CSRF fails', async () => {
    mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF' }, { status: 403 }));
    const res = await PATCH(makeReq('u1', { role: 'ADMIN' }), paramsOf('u1'));
    expect(res.status).toBe(403);
    expect(mockRequireSuperadmin).not.toHaveBeenCalled();
  });
});
