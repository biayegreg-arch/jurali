// Untested-route audit fix — POST /api/auth/resend-verification.
//
// Mocking notes:
//   - The route's own `if (!redis)` fail-closed guard reads the raw `redis`
//     export directly (separate from the limiter's own fallback), so a
//     getter-based module mock (mirrors admin/rate-limits/route.test.ts)
//     lets tests flip it between a truthy stub and null.
//   - `createEmailLimiter` is built once at module load; mocking the whole
//     factory to a no-op stub sidesteps needing a working fake Redis client
//     just to exercise the route's own enumeration-resistance logic.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// The route builds its rate limiter (and reads `redis` for its own
// fail-closed guard) at MODULE LOAD time — before any later `const` in this
// file would normally run. `vi.hoisted` puts this state at the same hoisted
// position as the `vi.mock` calls below so it's already initialized by the
// time the route module (imported further down) evaluates.
const { redisHolder, limiterCheck } = vi.hoisted(() => ({
  redisHolder: { current: {} as object | null },
  limiterCheck: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/server/redis', () => ({
  get redis() {
    return redisHolder.current;
  },
}));

vi.mock('@/lib/server/middleware/rate-limit-by-email', () => ({
  createEmailLimiter: () => ({ check: limiterCheck, refund: vi.fn() }),
}));

vi.mock('@/lib/server/outbox', () => ({ enqueueOutbox: vi.fn().mockResolvedValue(undefined) }));

import { enqueueOutbox } from '@/lib/server/outbox';
import { POST } from './route';

const mockEnqueueOutbox = vi.mocked(enqueueOutbox);

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://test/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  redisHolder.current = {};
  limiterCheck.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('returns 503 RATE_LIMIT_UNAVAILABLE when Redis is absent (fail-closed)', async () => {
    redisHolder.current = null;
    const res = await POST(makeReq({ email: 'shop@example.com' }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('re-issues a code and enqueues the outbox email for an unverified account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'shop@example.com',
      emailVerifiedAt: null,
    } as never);

    const res = await POST(makeReq({ email: 'shop@example.com' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prismaMock.verificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', type: 'EMAIL_VERIFY' }),
      }),
    );
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'email.verification_code',
        payload: expect.objectContaining({ to: 'shop@example.com' }),
      }),
    );
  });

  it('enumeration-resistant: unknown email returns the same 200 ok, no code issued', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ email: 'nobody@example.com' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prismaMock.verificationCode.create).not.toHaveBeenCalled();
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });

  it('enumeration-resistant: an already-verified account returns the same 200 ok, no code issued', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'shop@example.com',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    } as never);

    const res = await POST(makeReq({ email: 'shop@example.com' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prismaMock.verificationCode.create).not.toHaveBeenCalled();
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-email limiter rejects the request', async () => {
    const { NextResponse } = await import('next/server');
    limiterCheck.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_RESEND_ATTEMPTS' }, { status: 429 }),
    );
    const res = await POST(makeReq({ email: 'shop@example.com' }));
    expect(res.status).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED for a malformed email', async () => {
    const res = await POST(makeReq({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
  });
});
