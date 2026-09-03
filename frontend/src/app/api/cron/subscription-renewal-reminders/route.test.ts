import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const findMany = vi.fn();
const emailJobCreate = vi.fn();
const subscriptionUpdate = vi.fn();
const $transaction = vi.fn(
  async (
    cb: (tx: {
      emailJob: { create: typeof emailJobCreate };
      subscription: { update: typeof subscriptionUpdate };
    }) => unknown,
  ) => cb({ emailJob: { create: emailJobCreate }, subscription: { update: subscriptionUpdate } }),
);
vi.mock('@/lib/server/prisma', () => ({
  prisma: { subscription: { findMany }, $transaction },
}));

const push = vi.fn();
const queueMock = { push };
const getEmailQueueMock = vi.fn(() => queueMock as { push: typeof push } | null);
vi.mock('@/lib/server/queues/email-queue-singleton', () => ({
  getEmailQueue: getEmailQueueMock,
}));

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  vi.stubEnv('PUBLIC_URL', 'https://jurali.example.com');
  findMany.mockReset();
  $transaction.mockReset();
  $transaction.mockImplementation(async (cb) =>
    cb({ emailJob: { create: emailJobCreate }, subscription: { update: subscriptionUpdate } }),
  );
  emailJobCreate.mockReset();
  emailJobCreate.mockResolvedValue({ id: 'job-1' });
  subscriptionUpdate.mockReset();
  subscriptionUpdate.mockResolvedValue({});
  push.mockReset();
  push.mockResolvedValue(undefined);
  getEmailQueueMock.mockReturnValue(queueMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/subscription-renewal-reminders', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS);

function subWith(overrides: Partial<Record<string, unknown>> = {}) {
  return [
    {
      id: 'sub-1',
      renewsAt: day(2),
      reminderStage: null,
      reminderStageRenewsAt: null,
      planAmountFcfa: 2500,
      owner: { email: 'shop@example.com' },
      ...overrides,
    },
  ];
}

describe('POST /api/cron/subscription-renewal-reminders', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('queries only ACTIVE subscriptions with a renewsAt set', async () => {
    findMany.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    await POST(makeReq());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', renewsAt: { not: null } } }),
    );
  });

  it('is a graceful no-op when the email queue is not configured', async () => {
    getEmailQueueMock.mockReturnValueOnce(null);
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scanned: 0, sent: 0, skippedSyntheticEmail: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('sends the 3-day email and stamps the stage atomically, then pushes the work pointer', async () => {
    findMany.mockResolvedValueOnce(subWith({ renewsAt: day(3) }));
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ scanned: 1, sent: 1, skippedSyntheticEmail: 0 });
    expect(emailJobCreate).toHaveBeenCalledTimes(1);
    const jobData = emailJobCreate.mock.calls[0]![0].data;
    expect(jobData.to).toBe('shop@example.com');
    expect(jobData.subject).toContain('3 jours');
    expect(subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { reminderStage: '3d', reminderStageRenewsAt: expect.any(Date) },
    });
    // Redis push only happens after the DB transaction (job + stage) commits.
    expect(push).toHaveBeenCalledWith({ emailJobId: 'job-1' });
  });

  it('sends the 1-day email when already stamped "3d" for this cycle', async () => {
    const renewsAt = day(0.5);
    findMany.mockResolvedValueOnce(
      subWith({ renewsAt, reminderStage: '3d', reminderStageRenewsAt: renewsAt }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).sent).toBe(1);
    const jobData = emailJobCreate.mock.calls[0]![0].data;
    expect(jobData.subject).toContain('demain');
    expect(subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { reminderStage: '1d', reminderStageRenewsAt: renewsAt },
    });
  });

  it('sends the expired email once renewsAt has passed and flips status to EXPIRED', async () => {
    const renewsAt = day(-1);
    findMany.mockResolvedValueOnce(
      subWith({ renewsAt, reminderStage: '1d', reminderStageRenewsAt: renewsAt }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).sent).toBe(1);
    const jobData = emailJobCreate.mock.calls[0]![0].data;
    expect(jobData.subject).toContain('expiré');
    expect(subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { reminderStage: 'expired', reminderStageRenewsAt: renewsAt, status: 'EXPIRED' },
    });
  });

  it('does not resend a stage already sent for the current renewsAt', async () => {
    const renewsAt = day(2);
    findMany.mockResolvedValueOnce(
      subWith({ renewsAt, reminderStage: '3d', reminderStageRenewsAt: renewsAt }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).sent).toBe(0);
    expect($transaction).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('skips a phone-signup owner with a synthetic, non-deliverable email', async () => {
    findMany.mockResolvedValueOnce(
      subWith({ renewsAt: day(3), owner: { email: '221771234567@phone.jurali.local' } }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toMatchObject({ scanned: 1, sent: 0, skippedSyntheticEmail: 1 });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('skips a subscription outside every reminder window', async () => {
    findMany.mockResolvedValueOnce(subWith({ renewsAt: day(10) }));
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect((await res.json()).sent).toBe(0);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('one subscription failing does not abort the tick, does not count it as sent, and never pushes a work pointer for it', async () => {
    findMany.mockResolvedValueOnce([
      ...subWith({ id: 'sub-fail', renewsAt: day(3), owner: { email: 'fails@example.com' } }),
      ...subWith({ id: 'sub-ok', renewsAt: day(3), owner: { email: 'ok@example.com' } }),
    ]);
    // Simulates the whole job-create + stage-update transaction aborting
    // (e.g. a transient DB error) for the first subscription — both writes
    // roll back together, so no orphan EmailJob and no stuck stage.
    $transaction.mockImplementationOnce(() => Promise.reject(new Error('db blip')));
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json()).sent).toBe(1);
    expect($transaction).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledTimes(1);
  });
});
