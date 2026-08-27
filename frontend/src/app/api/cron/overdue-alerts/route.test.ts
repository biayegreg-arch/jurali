import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const findMany = vi.fn();
const notificationCreate = vi.fn();
vi.mock('@/lib/server/prisma', () => ({
  prisma: { user: { findMany }, notification: { create: notificationCreate } },
}));

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  findMany.mockReset();
  notificationCreate.mockReset();
  notificationCreate.mockResolvedValue({ id: 'notif-1' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/overdue-alerts', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

const day = (offsetDays: number) => new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);

function userWith(
  clients: unknown[],
  subscription: unknown = { status: 'ACTIVE', renewsAt: day(-30) },
) {
  return [{ id: 'user-1', clients, subscription }];
}

describe('POST /api/cron/overdue-alerts', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('only queries users with overdueAlertsEnabled, then filters to an active Premium subscription in-app', async () => {
    findMany.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { overdueAlertsEnabled: true },
      }),
    );
  });

  it('excludes a fetched user whose subscription has lapsed (isSubscriptionActive, not a raw status filter)', async () => {
    findMany.mockResolvedValueOnce(
      userWith(
        [
          {
            id: 'client-1',
            transactions: [{ type: 'DEBT', amountFcfa: 5_000, createdAt: day(20) }],
          },
        ],
        { status: 'ACTIVE', renewsAt: day(1) }, // renewsAt in the past — lapsed
      ),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body).toMatchObject({ usersScanned: 0, usersNotified: 0 });
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('creates ONE digest notification per user when they have clients overdue 14+ days', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        { id: 'client-1', transactions: [{ type: 'DEBT', amountFcfa: 5_000, createdAt: day(20) }] },
        { id: 'client-2', transactions: [{ type: 'DEBT', amountFcfa: 5_000, createdAt: day(1) }] },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ usersScanned: 1, usersNotified: 1 });
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    const created = notificationCreate.mock.calls[0]![0].data;
    expect(created.userId).toBe('user-1');
    expect(created.type).toBe('OVERDUE_ALERT');
    expect(created.data).toEqual({ overdueCount: 1 });
    expect(created.dedupeKey).toMatch(/^overdue-alert:user-1:\d{4}-\d{2}-\d{2}$/);
  });

  it('does not notify a user with no clients overdue 14+ days', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        { id: 'client-1', transactions: [{ type: 'DEBT', amountFcfa: 5_000, createdAt: day(3) }] },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).usersNotified).toBe(0);
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('does not notify a user whose overdue debt is fully paid off', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          transactions: [
            { type: 'DEBT', amountFcfa: 5_000, createdAt: day(20) },
            { type: 'PAYMENT', amountFcfa: 5_000, createdAt: day(1) },
          ],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).usersNotified).toBe(0);
  });
});
