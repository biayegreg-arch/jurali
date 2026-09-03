// Untested-route audit fix — POST /api/auth/set-password.
// Mirrors change-password/route.test.ts's mocking strategy, but seeds auth
// via the Authorization: Bearer header instead of a cookie (requireAuth
// falls back to it when no access cookie is present — simpler than wiring
// the writable next/headers mock just to seed the input side).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';

mockNextCookies();

vi.mock('@/lib/server/auth/banned-passwords', () => ({
  isBanned: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/server/auth/hibp', () => ({
  isPwned: vi.fn().mockResolvedValue(false),
}));

import { isBanned } from '@/lib/server/auth/banned-passwords';
import { isPwned } from '@/lib/server/auth/hibp';
import {
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  createAccessToken,
} from '@/lib/server/auth';
import { POST } from './route';

const CSRF_TOKEN = 'csrf-token-fixture-deadbeef';

function buildRequest(opts: {
  body: unknown;
  auth?: string | null;
  csrf?: string | null;
  csrfCookieValue?: string | null;
}): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (opts.auth !== null && opts.auth !== undefined) {
    headers.set('authorization', `Bearer ${opts.auth}`);
  }
  if (opts.csrf !== null && opts.csrf !== undefined) {
    headers.set('x-csrf-token', opts.csrf);
  }
  const cookies: string[] = [];
  if (opts.csrfCookieValue !== null && opts.csrfCookieValue !== undefined) {
    cookies.push(`${CSRF_COOKIE_NAME}=${opts.csrfCookieValue}`);
  }
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  return new NextRequest('http://localhost/api/auth/set-password', {
    method: 'POST',
    headers,
    body: JSON.stringify(opts.body),
  });
}

let validToken: string;

const isBannedMock = vi.mocked(isBanned);
const isPwnedMock = vi.mocked(isPwned);

beforeEach(async () => {
  __cookieStore.clear();
  validToken = await createAccessToken({
    sub: 'user_1',
    email: 'user@example.com',
    tokenVersion: 0,
  });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'user_1',
    email: 'user@example.com',
    passwordHash: null,
    tokenVersion: 0,
  } as unknown as never);
  prismaMock.user.update.mockResolvedValue({
    id: 'user_1',
    email: 'user@example.com',
    tokenVersion: 1,
  } as unknown as never);
  isBannedMock.mockReturnValue(false);
  isPwnedMock.mockResolvedValue(false);
  delete process.env.PASSWORD_HIBP_CHECK;
  delete process.env.AUTH_PASSWORD_MIN_LENGTH;
});

describe('POST /api/auth/set-password', () => {
  it('happy path: hashes the password, bumps tokenVersion, sets fresh cookies', async () => {
    const req = buildRequest({
      body: { newPassword: 'Brand-New-Pass-2026' },
      auth: validToken,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_1' },
        data: { passwordHash: expect.any(String), tokenVersion: { increment: 1 } },
      }),
    );
    expect(__cookieStore.has(COOKIE_NAME)).toBe(true);
    expect(__cookieStore.has(REFRESH_COOKIE_NAME)).toBe(true);
    expect(__cookieStore.has(CSRF_COOKIE_NAME)).toBe(true);
  });

  it('returns 403 when CSRF token is missing', async () => {
    const req = buildRequest({
      body: { newPassword: 'Brand-New-Pass-2026' },
      auth: validToken,
      csrf: null,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no session at all', async () => {
    const req = buildRequest({
      body: { newPassword: 'Brand-New-Pass-2026' },
      auth: null,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 409 PASSWORD_ALREADY_SET for an account that already has a password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'user@example.com',
      passwordHash: 'existing-hash',
      tokenVersion: 0,
    } as unknown as never);
    const req = buildRequest({
      body: { newPassword: 'Brand-New-Pass-2026' },
      auth: validToken,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('PASSWORD_ALREADY_SET');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 400 PASSWORD_BANNED for a common password', async () => {
    isBannedMock.mockReturnValue(true);
    const req = buildRequest({
      body: { newPassword: 'password123' },
      auth: validToken,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PASSWORD_BANNED');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 400 PASSWORD_TOO_SHORT below the configured minimum', async () => {
    const req = buildRequest({
      body: { newPassword: 'short1' },
      auth: validToken,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PASSWORD_TOO_SHORT');
  });

  it('returns 400 PASSWORD_PWNED when HIBP check is enabled and the password is breached', async () => {
    process.env.PASSWORD_HIBP_CHECK = '1';
    isPwnedMock.mockResolvedValue(true);
    const req = buildRequest({
      body: { newPassword: 'Brand-New-Pass-2026' },
      auth: validToken,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('PASSWORD_PWNED');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED for a malformed body', async () => {
    const req = buildRequest({
      body: { newPassword: 123 },
      auth: validToken,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
  });

  it('returns 404 USER_NOT_FOUND when the row vanishes between requireAuth and the route lookup', async () => {
    // requireAuth() does its own findUnique to validate tokenVersion — that
    // one must still resolve for auth to succeed. Only the ROUTE's own
    // second lookup (right before the password write) is the one this
    // branch guards, so it's mocked null on the second call only.
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: 'user_1',
        email: 'user@example.com',
        tokenVersion: 0,
      } as unknown as never)
      .mockResolvedValueOnce(null as unknown as never);
    const req = buildRequest({
      body: { newPassword: 'Brand-New-Pass-2026' },
      auth: validToken,
      csrf: CSRF_TOKEN,
      csrfCookieValue: CSRF_TOKEN,
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('USER_NOT_FOUND');
  });

  it("exports runtime='nodejs' and a POST handler", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, 'route.ts'), 'utf8');
    expect(src).toMatch(/runtime\s*=\s*['"]nodejs['"]/);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
  });
});
