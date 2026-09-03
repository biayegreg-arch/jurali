// POST /api/auth/verify-pending-email tests — 2026-09-03.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

mockNextCookies();

import { CSRF_COOKIE_NAME, createAccessToken } from '@/lib/server/auth';
import { POST } from './route';

const CSRF_TOKEN = 'csrf-token-fixture-deadbeef';
const VALID_CODE = 'ABCD2345'; // 8-char Crockford alphabet

function makeReq(
  body: unknown,
  opts?: { csrf?: string | null; auth?: string | null },
): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  const csrf = opts?.csrf === undefined ? CSRF_TOKEN : opts.csrf;
  if (csrf !== null) headers.set('x-csrf-token', csrf);
  headers.set('cookie', `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`);
  const auth = opts?.auth === undefined ? validToken : opts.auth;
  if (auth !== null) headers.set('authorization', `Bearer ${auth}`);
  return new NextRequest('http://test/api/auth/verify-pending-email', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

describe('POST /api/auth/verify-pending-email', () => {
  it('happy path: promotes pendingEmail to email, sets emailVerifiedAt, clears pendingEmail', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: 'shop@example.com',
    } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue({
      id: 'vc1',
      code: VALID_CODE,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    prismaMock.verificationCode.updateMany.mockResolvedValue({ count: 1 } as never);

    const res = await POST(makeReq({ code: VALID_CODE }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, email: 'shop@example.com' });

    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    const updateArg = prismaMock.user.update.mock.calls[0]?.[0];
    expect(updateArg).toMatchObject({
      where: { id: userId },
      data: { email: 'shop@example.com', pendingEmail: null },
    });
    expect(updateArg?.data?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('missing CSRF header returns 403', async () => {
    const res = await POST(makeReq({ code: VALID_CODE }, { csrf: null }));
    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('missing access token returns 401', async () => {
    const res = await POST(makeReq({ code: VALID_CODE }, { auth: null }));
    expect(res.status).toBe(401);
  });

  it('no pendingEmail on the account returns 400 NO_PENDING_EMAIL', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: null,
    } as never);

    const res = await POST(makeReq({ code: VALID_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'NO_PENDING_EMAIL' });
  });

  it('wrong/consumed code returns 400 VERIFICATION_CODE_INVALID', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: 'shop@example.com',
    } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue(null);

    const res = await POST(makeReq({ code: VALID_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'VERIFICATION_CODE_INVALID' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('expired code returns 400 VERIFICATION_CODE_EXPIRED', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: 'shop@example.com',
    } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue({
      id: 'vc1',
      code: VALID_CODE,
      expiresAt: new Date(Date.now() - 1000),
    } as never);

    const res = await POST(makeReq({ code: VALID_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'VERIFICATION_CODE_EXPIRED' });
  });

  it('TOCTOU race — updateMany count 0 returns 400 VERIFICATION_CODE_INVALID', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: 'shop@example.com',
    } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue({
      id: 'vc1',
      code: VALID_CODE,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    prismaMock.verificationCode.updateMany.mockResolvedValue({ count: 0 } as never);

    const res = await POST(makeReq({ code: VALID_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'VERIFICATION_CODE_INVALID' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('email claimed by someone else mid-flight rolls back and returns 409 EMAIL_ALREADY_REGISTERED', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: 'shop@example.com',
    } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue({
      id: 'vc1',
      code: VALID_CODE,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    prismaMock.verificationCode.updateMany.mockResolvedValue({ count: 1 } as never);
    const p2002 = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      name: 'PrismaClientKnownRequestError',
    });
    prismaMock.user.update.mockRejectedValue(p2002 as never);

    const res = await POST(makeReq({ code: VALID_CODE }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('invalid code format returns 400 VALIDATION_FAILED', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'phone-1@phone.jurali.local',
      tokenVersion: 0,
      pendingEmail: 'shop@example.com',
    } as never);

    const res = await POST(makeReq({ code: 'nope' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'VALIDATION_FAILED' });
  });

  it("source contains runtime='nodejs' (Phase 0 invariant)", () => {
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
  });
});
