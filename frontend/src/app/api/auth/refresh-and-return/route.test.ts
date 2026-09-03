// Untested-route audit fix — GET /api/auth/refresh-and-return.
//
// Uses real auth.ts crypto (protected file — never mocked) to mint a valid
// refresh token, attached via the request `cookie` header since the route
// reads it through NextRequest.cookies, not next/headers. Output cookies
// (the freshly-minted session) go through next/headers, mocked via the
// shared mockNextCookies() util. acquireRefreshLock's Redis-absent fallback
// is a per-process Map keyed by userId — distinct userIds per test avoid
// any cross-test lock contention, so it's exercised for real rather than
// mocked.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

import {
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  createRefreshToken,
} from '@/lib/server/auth';
import { acquireRefreshLock } from '@/lib/server/auth/refresh-lock';
import { GET } from './route';

let testCounter = 0;

function makeReq(opts: { refreshToken?: string | null; next?: string } = {}): NextRequest {
  const qs = opts.next !== undefined ? `?next=${encodeURIComponent(opts.next)}` : '';
  const headers = new Headers();
  if (opts.refreshToken) {
    headers.set('cookie', `${REFRESH_COOKIE_NAME}=${opts.refreshToken}`);
  }
  return new NextRequest(`http://localhost/api/auth/refresh-and-return${qs}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  delete process.env.AUTH_LOGIN_PATH;
});

describe('GET /api/auth/refresh-and-return', () => {
  it('redirects to /login when there is no refresh cookie at all', async () => {
    const res = await GET(makeReq({ next: '/dashboard' }));
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/dashboard');
  });

  it('redirects to /login when the refresh cookie is garbage', async () => {
    const res = await GET(makeReq({ refreshToken: 'not-a-real-token', next: '/dashboard' }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('redirects to /login when the token subject no longer exists', async () => {
    const userId = `u-${++testCounter}`;
    const token = await createRefreshToken(userId, 0);
    prismaMock.user.findUnique.mockResolvedValue(null as never);

    const res = await GET(makeReq({ refreshToken: token, next: '/dashboard' }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('redirects to /login when tokenVersion no longer matches (revoked session)', async () => {
    const userId = `u-${++testCounter}`;
    const token = await createRefreshToken(userId, 0);
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      tokenVersion: 1,
      status: 'ACTIVE',
    } as never);

    const res = await GET(makeReq({ refreshToken: token, next: '/dashboard' }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('redirects to /login when the account is SUSPENDED', async () => {
    const userId = `u-${++testCounter}`;
    const token = await createRefreshToken(userId, 0);
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      tokenVersion: 0,
      status: 'SUSPENDED',
    } as never);

    const res = await GET(makeReq({ refreshToken: token, next: '/dashboard' }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('respects a custom AUTH_LOGIN_PATH', async () => {
    process.env.AUTH_LOGIN_PATH = '/connexion';
    const res = await GET(makeReq({ next: '/dashboard' }));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/connexion');
  });

  it('happy path: mints fresh cookies and 303s to the requested next path', async () => {
    const userId = `u-${++testCounter}`;
    const token = await createRefreshToken(userId, 0);
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      tokenVersion: 0,
      status: 'ACTIVE',
    } as never);

    const res = await GET(makeReq({ refreshToken: token, next: '/dashboard' }));

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/dashboard');
    expect(location.search).toBe('');
    expect(__cookieStore.has(COOKIE_NAME)).toBe(true);
    expect(__cookieStore.has(REFRESH_COOKIE_NAME)).toBe(true);
    expect(__cookieStore.has(CSRF_COOKIE_NAME)).toBe(true);
  });

  it('falls back to "/" for a protocol-relative next (open-redirect mitigation)', async () => {
    const res = await GET(makeReq({ next: '//evil.com' }));
    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('next')).toBe('/');
  });

  it('falls back to "/" for an absolute-URL next', async () => {
    const res = await GET(makeReq({ next: 'https://evil.com' }));
    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('next')).toBe('/');
  });

  it('bounces straight to next (no new cookies) when another tab is already rotating', async () => {
    const userId = `u-${++testCounter}`;
    const token = await createRefreshToken(userId, 0);
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'user@example.com',
      tokenVersion: 0,
      status: 'ACTIVE',
    } as never);
    // Hold the lock ourselves first — the route's own acquireRefreshLock
    // call for the SAME userId will then see contention (returns null),
    // exactly like a second concurrent tab racing the same rotation.
    const release = await acquireRefreshLock(userId);
    expect(release).not.toBeNull();

    const res = await GET(makeReq({ refreshToken: token, next: '/dashboard' }));

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/dashboard');
    expect(__cookieStore.has(COOKIE_NAME)).toBe(false);

    await release!();
  });
});
