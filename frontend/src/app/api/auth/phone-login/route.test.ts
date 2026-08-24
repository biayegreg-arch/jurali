// Jurali Phase 6 — POST /api/auth/phone-login tests.
// Pattern mirrors src/app/api/auth/login/route.test.ts, minus the
// emailVerifiedAt check (meaningless for phone-only accounts — there is no
// email to verify, see docs/superpowers/plans/2026-08-24-jurali-roadmap.md
// Phase 6).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';

mockNextCookies();

vi.mock('@/lib/server/auth/lockout', () => ({
  isLockedOut: vi.fn(),
  recordFailure: vi.fn(),
  recordSuccess: vi.fn(),
}));

vi.mock('@/lib/server/auth/dummy-bcrypt', () => ({
  dummyBcryptCompare: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return {
    ...actual,
    verifyPassword: vi.fn(),
  };
});

import { isLockedOut, recordFailure, recordSuccess } from '@/lib/server/auth/lockout';
import { dummyBcryptCompare } from '@/lib/server/auth/dummy-bcrypt';
import { verifyPassword } from '@/lib/server/auth';
import { POST } from './route';
import { NextRequest } from 'next/server';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('https://test/api/auth/phone-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __cookieStore.clear();
  vi.mocked(isLockedOut).mockReset();
  vi.mocked(recordFailure).mockReset();
  vi.mocked(recordSuccess).mockReset();
  vi.mocked(dummyBcryptCompare).mockReset();
  vi.mocked(verifyPassword).mockReset();
  vi.mocked(isLockedOut).mockResolvedValue(false);
  vi.mocked(recordFailure).mockResolvedValue({ count: 1, locked: false });
  vi.mocked(recordSuccess).mockResolvedValue(undefined);
  vi.mocked(dummyBcryptCompare).mockResolvedValue(undefined);
  vi.mocked(verifyPassword).mockResolvedValue(false);
});

describe('POST /api/auth/phone-login', () => {
  it('happy path — issues 3 cookies and returns user (no emailVerifiedAt check)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: '221771234567@phone.jurali.local',
      phone: '+221771234567',
      passwordHash: '$2a$12$hashhashhashhashhashhashhashhashhashhashhashhashhashhha',
      tokenVersion: 0,
      status: 'ACTIVE',
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const res = await POST(makeReq({ phone: '+221771234567', password: 'longenough' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, user: { sub: 'u1', phone: '+221771234567' } });
    expect(recordSuccess).toHaveBeenCalledWith('+221771234567');
    expect(__cookieStore.has('app-token')).toBe(true);
    expect(__cookieStore.has('app-refresh')).toBe(true);
    expect(__cookieStore.has('app-csrf')).toBe(true);
  });

  it('no user with that phone — INVALID_CREDENTIALS, dummy compare called, no recordFailure', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ phone: '+221700000000', password: 'longenough' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_CREDENTIALS');
    expect(dummyBcryptCompare).toHaveBeenCalledWith('longenough');
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('wrong password — INVALID_CREDENTIALS + recordFailure called', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: '221771234567@phone.jurali.local',
      phone: '+221771234567',
      passwordHash: '$2a$12$hashhashhashhashhashhashhashhashhashhashhashhashhashhha',
      tokenVersion: 0,
      status: 'ACTIVE',
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const res = await POST(makeReq({ phone: '+221771234567', password: 'wrong' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_CREDENTIALS');
    expect(recordFailure).toHaveBeenCalledWith('+221771234567');
  });

  it('lockout already active — 423 LOCKED_OUT, no bcrypt', async () => {
    vi.mocked(isLockedOut).mockResolvedValue(true);

    const res = await POST(makeReq({ phone: '+221771234567', password: 'whatever' }));

    expect(res.status).toBe(423);
    expect((await res.json()).error).toBe('LOCKED_OUT');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('SUSPENDED user with valid credentials — 403 ACCOUNT_SUSPENDED, no cookies', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u_susp',
      email: '221700000009@phone.jurali.local',
      phone: '+221700000009',
      passwordHash: '$2a$12$hashhashhashhashhashhashhashhashhashhashhashhashhashhha',
      tokenVersion: 0,
      status: 'SUSPENDED',
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const res = await POST(makeReq({ phone: '+221700000009', password: 'longenough' }));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('ACCOUNT_SUSPENDED');
    expect(__cookieStore.has('app-token')).toBe(false);
  });

  it('VALIDATION_FAILED — missing password', async () => {
    const res = await POST(makeReq({ phone: '+221771234567' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
  });

  it('per-phone rate limit — 11th attempt returns 429 TOO_MANY_PHONE_LOGIN_ATTEMPTS', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await POST(makeReq({ phone: '+221799999999', password: 'longenough' }));
    }
    expect(last?.status).toBe(429);
    expect((await last!.json()).error).toBe('TOO_MANY_PHONE_LOGIN_ATTEMPTS');
  });
});
