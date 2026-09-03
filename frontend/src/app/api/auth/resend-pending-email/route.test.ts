// POST /api/auth/resend-pending-email tests — 2026-09-03.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/outbox', () => ({ enqueueOutbox: vi.fn().mockResolvedValue(undefined) }));

import { CSRF_COOKIE_NAME, createAccessToken } from '@/lib/server/auth';
import { enqueueOutbox } from '@/lib/server/outbox';
import { POST } from './route';

const CSRF_TOKEN = 'csrf-token-fixture-deadbeef';
const mockEnqueueOutbox = vi.mocked(enqueueOutbox);

function makeReq(opts?: { csrf?: string | null; auth?: string | null }): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  const csrf = opts?.csrf === undefined ? CSRF_TOKEN : opts.csrf;
  if (csrf !== null) headers.set('x-csrf-token', csrf);
  headers.set('cookie', `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`);
  const auth = opts?.auth === undefined ? validToken : opts.auth;
  if (auth !== null) headers.set('authorization', `Bearer ${auth}`);
  return new NextRequest('http://test/api/auth/resend-pending-email', {
    method: 'POST',
    headers,
  });
}

let validToken: string;
let userId: string;
let testCounter = 0;

beforeEach(async () => {
  vi.clearAllMocks();
  __cookieStore.clear();
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
  // Distinct sub per test: the rate limiter buckets by auth.user.sub, and its
  // in-memory store is a module-level singleton shared across every test in
  // this file — reusing one id would make later tests trip the 429 threshold.
  userId = `u-${++testCounter}`;
  validToken = await createAccessToken({
    sub: userId,
    email: 'phone-1@phone.jurali.local',
    tokenVersion: 0,
  });
});

describe('POST /api/auth/resend-pending-email', () => {
  it('happy path: creates a new code and enqueues the outbox email event', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: 'shop@example.com',
    } as never);

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    expect(prismaMock.verificationCode.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.verificationCode.create.mock.calls[0]?.[0];
    expect(createArg?.data).toMatchObject({ userId, type: 'EMAIL_VERIFY' });

    expect(mockEnqueueOutbox).toHaveBeenCalledTimes(1);
    const outboxArg = mockEnqueueOutbox.mock.calls[0]?.[1];
    expect(outboxArg).toMatchObject({
      kind: 'email.verification_code',
      payload: expect.objectContaining({ to: 'shop@example.com' }),
    });
  });

  it('missing CSRF header returns 403', async () => {
    const res = await POST(makeReq({ csrf: null }));
    expect(res.status).toBe(403);
    expect(prismaMock.verificationCode.create).not.toHaveBeenCalled();
  });

  it('missing access token returns 401', async () => {
    const res = await POST(makeReq({ auth: null }));
    expect(res.status).toBe(401);
  });

  it('no pendingEmail on the account returns 400 NO_PENDING_EMAIL', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: null,
    } as never);

    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'NO_PENDING_EMAIL' });
    expect(prismaMock.verificationCode.create).not.toHaveBeenCalled();
  });

  it("source contains runtime='nodejs' (Phase 0 invariant)", () => {
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
  });
});
