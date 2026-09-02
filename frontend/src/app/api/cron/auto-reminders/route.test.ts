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
  return new NextRequest('http://localhost/api/cron/auto-reminders', {
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

describe('POST /api/cron/auto-reminders', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('only queries users with autoReminderEnabled, then filters to an active Premium subscription in-app', async () => {
    findMany.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { autoReminderEnabled: true },
      }),
    );
  });

  it('excludes a fetched user whose subscription has lapsed (isSubscriptionActive, not a raw status filter)', async () => {
    findMany.mockResolvedValueOnce(
      userWith(
        [
          {
            id: 'client-1',
            firstName: 'Awa',
            phone: '+221771234567',
            lastReminderSentAt: null,
            transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: day(10) }],
          },
        ],
        { status: 'ACTIVE', renewsAt: day(1) }, // renewsAt in the past — lapsed
      ),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body).toMatchObject({ usersScanned: 0, clientsScanned: 0, notified: 0 });
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('creates a notification for a client 7+ days overdue with no reminder sent', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: '+221771234567',
          lastReminderSentAt: null,
          transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: day(10) }],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ usersScanned: 1, clientsScanned: 1, notified: 1 });
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    const created = notificationCreate.mock.calls[0]![0].data;
    expect(created.userId).toBe('user-1');
    expect(created.type).toBe('AUTO_REMINDER_DUE');
    expect(created.data).toEqual({ clientId: 'client-1' });
    expect(created.dedupeKey).toMatch(/^auto-reminder:client-1:/);
  });

  it('skips a client whose debt is younger than 7 days', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: '+221771234567',
          lastReminderSentAt: null,
          transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: day(2) }],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).notified).toBe(0);
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('skips a client with no phone', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: null,
          lastReminderSentAt: null,
          transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: day(10) }],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).notified).toBe(0);
  });

  it('skips a client that already has a reminder sent after the debt started aging', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: '+221771234567',
          lastReminderSentAt: day(3),
          transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: day(10) }],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).notified).toBe(0);
  });

  it('skips a client whose debt is fully paid off', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: '+221771234567',
          lastReminderSentAt: null,
          transactions: [
            { type: 'DEBT', amountFcfa: 12_500, createdAt: day(10) },
            { type: 'PAYMENT', amountFcfa: 12_500, createdAt: day(1) },
          ],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).notified).toBe(0);
  });

  it('skips a client with autoReminderEnabled explicitly set to false', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: '+221771234567',
          lastReminderSentAt: null,
          autoReminderEnabled: false,
          transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: day(10) }],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).notified).toBe(0);
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('uses a client-specific autoReminderThresholdDays override instead of the 7-day default', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: '+221771234567',
          lastReminderSentAt: null,
          autoReminderThresholdDays: 3,
          transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: day(4) }],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).notified).toBe(1);
    const created = notificationCreate.mock.calls[0]![0].data;
    expect(created.body).toContain('3 jours');
  });

  it('handles multiple clients across the count correctly', async () => {
    findMany.mockResolvedValueOnce(
      userWith([
        {
          id: 'client-1',
          firstName: 'Awa',
          phone: '+221771234567',
          lastReminderSentAt: null,
          transactions: [{ type: 'DEBT', amountFcfa: 5_000, createdAt: day(10) }],
        },
        {
          id: 'client-2',
          firstName: 'Moussa',
          phone: '+221779998877',
          lastReminderSentAt: null,
          transactions: [{ type: 'DEBT', amountFcfa: 5_000, createdAt: day(1) }],
        },
      ]),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body).toMatchObject({ clientsScanned: 2, notified: 1 });
  });
});
