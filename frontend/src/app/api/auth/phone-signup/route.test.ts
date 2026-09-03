// Jurali Phase 6 — POST /api/auth/phone-signup tests.
// Pattern mirrors src/app/api/auth/signup/route.test.ts (D-25 mock Prisma +
// module-level vi.mock so prismaMock import hoists above route imports),
// but this flow is NOT enumeration-resistant (409 PHONE_ALREADY_EXISTS on
// an existing phone) — a deliberate divergence from email signup, see
// docs/superpowers/plans/2026-08-24-jurali-roadmap.md Phase 6.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/auth/hibp', () => ({
  isPwned: vi.fn().mockResolvedValue(false),
}));

import { POST } from './route';

function makeReq(body: unknown): NextRequest {
  return body === undefined
    ? new NextRequest('http://test/api/auth/phone-signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
    : new NextRequest('http://test/api/auth/phone-signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
}

const validBody = {
  name: 'Mamadou Diallo',
  phone: '+221771234567',
  shopName: 'Boutique Diallo',
  password: 'a-strong-passphrase',
};

beforeEach(() => {
  __cookieStore.clear();
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('POST /api/auth/phone-signup', () => {
  it('creates a new user and issues 3 cookies for a genuinely new phone', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'u-new',
      email: '221771234567@phone.jurali.local',
      tokenVersion: 0,
    } as never);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, user: { sub: 'u-new', phone: '+221771234567' } });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+221771234567',
          name: 'Mamadou Diallo',
          shopName: 'Boutique Diallo',
        }),
      }),
    );
    expect(__cookieStore.has('app-token')).toBe(true);
    expect(__cookieStore.has('app-refresh')).toBe(true);
    expect(__cookieStore.has('app-csrf')).toBe(true);
  });

  it('returns 409 PHONE_ALREADY_EXISTS (not 500) when create() races past the pre-check (P2002)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockRejectedValue(
      Object.assign(new Error('unique violation'), { code: 'P2002' }),
    );

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('PHONE_ALREADY_EXISTS');
  });

  it('returns 409 PHONE_ALREADY_EXISTS for a phone already registered (not enumeration-resistant)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' } as never);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('PHONE_ALREADY_EXISTS');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(__cookieStore.has('app-token')).toBe(false);
  });

  it('returns VALIDATION_FAILED for a malformed phone', async () => {
    const res = await POST(makeReq({ ...validBody, phone: 'not-a-phone' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
  });

  it('returns VALIDATION_FAILED when shopName is missing', async () => {
    const rest: Record<string, unknown> = { ...validBody };
    delete rest.shopName;
    const res = await POST(makeReq(rest));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
  });

  it('returns PASSWORD_TOO_SHORT for a weak password, before any DB lookup', async () => {
    const res = await POST(makeReq({ ...validBody, password: 'short' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PASSWORD_TOO_SHORT');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('optional email creates a VerificationCode and enqueues an outbox event, response has emailPending:true', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'u-new',
      email: '221771234567@phone.jurali.local',
      tokenVersion: 0,
    } as never);

    const res = await POST(makeReq({ ...validBody, email: 'shop@example.com' }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, emailPending: true });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pendingEmail: 'shop@example.com' }),
      }),
    );
    expect(prismaMock.verificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u-new', type: 'EMAIL_VERIFY' }),
      }),
    );
  });

  it('omitted email skips VerificationCode creation, response has emailPending:false', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'u-new',
      email: '221771234567@phone.jurali.local',
      tokenVersion: 0,
    } as never);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, emailPending: false });
    expect(prismaMock.verificationCode.create).not.toHaveBeenCalled();
  });

  it('per-phone rate limit — 6th attempt in the signup window returns 429', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' } as never);

    let last: Response | undefined;
    for (let i = 0; i < 6; i++) {
      last = await POST(makeReq({ ...validBody, phone: '+221700000001' }));
    }
    expect(last?.status).toBe(429);
    expect((await last!.json()).error).toBe('TOO_MANY_PHONE_SIGNUP_ATTEMPTS');
  });
});
