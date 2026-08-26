// Tests for GET /api/auth/me (AUTH-06).
// Pattern 14. requireAuth-gated. Note: requireAuth uses cookies() from
// next/headers internally, so tests must use mockNextCookies + prismaMock.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';

mockNextCookies();

vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return {
    ...actual,
    verifyToken: vi.fn(),
  };
});

import { verifyToken } from '@/lib/server/auth';
import { GET, PATCH } from './route';
import { NextRequest } from 'next/server';

function makeReq(opts: { tokenCookie?: string; bearer?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  return new NextRequest('https://test/api/auth/me', {
    method: 'GET',
    headers,
  });
}

function makePatchReq(
  body: unknown,
  opts: { bearer?: string; csrf?: 'match' | 'missing' } = {},
): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if ((opts.csrf ?? 'match') === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('https://test/api/auth/me', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __cookieStore.clear();
  vi.mocked(verifyToken).mockReset();
});

describe('GET /api/auth/me', () => {
  it('Test 1: authed — returns user identity', async () => {
    // Place token cookie via mock store; requireAuth reads it via cookies().
    __cookieStore.clear();
    // Fake cookies.set: use mockStore via the mock-cookies internal store.
    // Simpler: test injects directly through Bearer header path which
    // requireAuth supports as a fallback when no cookie is present.
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    } as never);

    const res = await GET(makeReq({ bearer: 'valid-access-token' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      user: { sub: 'u1', email: 'a@b.com' },
    });
  });

  it('Test 1b: returns the real name when the user has one (sidebar identity block, Phase 9)', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
      name: 'Mamadou Diallo',
    } as never);

    const res = await GET(makeReq({ bearer: 'valid-access-token' }));
    const body = (await res.json()) as { user: { name: string | null } };
    expect(body.user.name).toBe('Mamadou Diallo');
  });

  it('Phase 9: returns phone + address', async () => {
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'u1', email: 'a@b.com', tokenVersion: 0 });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
      phone: '+221771234567',
      address: 'Médina, Dakar',
    } as never);

    const res = await GET(makeReq({ bearer: 'valid-access-token' }));
    const body = (await res.json()) as { user: { phone: string | null; address: string | null } };
    expect(body.user.phone).toBe('+221771234567');
    expect(body.user.address).toBe('Médina, Dakar');
  });

  it('Test 2: no cookie + no bearer — 401 missing token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Missing token|token/i);
  });

  it('Test 3: stale tokenVersion — 401', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 1, // bumped via change-password
    } as never);

    const res = await GET(makeReq({ bearer: 'stale-jwt' }));
    expect(res.status).toBe(401);
  });

  it('Test 4: deleted user — 401', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'u-deleted',
      email: 'gone@b.com',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await GET(makeReq({ bearer: 'orphan-jwt' }));
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/me', () => {
  beforeEach(() => {
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'u1', email: 'a@b.com', tokenVersion: 0 });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    } as never);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await PATCH(makePatchReq({ name: 'X' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF token is missing', async () => {
    const res = await PATCH(makePatchReq({ name: 'X' }, { bearer: 'tok', csrf: 'missing' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 VALIDATION_FAILED for an invalid phone', async () => {
    const res = await PATCH(makePatchReq({ phone: 'not-a-phone' }, { bearer: 'tok' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 PHONE_ALREADY_EXISTS when another user already has that phone', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'someone-else' } as never);
    const res = await PATCH(makePatchReq({ phone: '+221771234567' }, { bearer: 'tok' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('PHONE_ALREADY_EXISTS');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('updates name/shopName/phone/address and returns the updated user', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({
      name: 'Mamadou Diallo',
      shopName: 'Boutique Diallo',
      phone: '+221771234567',
      address: 'Médina, Dakar',
    } as never);

    const res = await PATCH(
      makePatchReq(
        {
          name: 'Mamadou Diallo',
          shopName: 'Boutique Diallo',
          phone: '+221771234567',
          address: 'Médina, Dakar',
        },
        { bearer: 'tok' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { name: string; address: string } };
    expect(body.user.name).toBe('Mamadou Diallo');
    expect(body.user.address).toBe('Médina, Dakar');
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          name: 'Mamadou Diallo',
          shopName: 'Boutique Diallo',
          phone: '+221771234567',
          address: 'Médina, Dakar',
        }),
      }),
    );
  });

  it('only updates the fields provided (partial update)', async () => {
    prismaMock.user.update.mockResolvedValue({ address: 'Plateau, Dakar' } as never);
    const res = await PATCH(makePatchReq({ address: 'Plateau, Dakar' }, { bearer: 'tok' }));
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { address: 'Plateau, Dakar' } }),
    );
  });

  it('returns 409 PHONE_REQUIRED when clearing phone would lock a phone-only account out', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      tokenVersion: 0,
      phone: '+221771234567',
      email: '221771234567@phone.jurali.local',
      emailVerifiedAt: null,
      oauthAccounts: [],
    } as never);

    const res = await PATCH(makePatchReq({ phone: '' }, { bearer: 'tok' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('PHONE_REQUIRED');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('allows clearing phone when the account has a verified email', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      tokenVersion: 0,
      phone: '+221771234567',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
      oauthAccounts: [],
    } as never);
    prismaMock.user.update.mockResolvedValue({ phone: null } as never);

    const res = await PATCH(makePatchReq({ phone: '' }, { bearer: 'tok' }));
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null }) }),
    );
  });

  it('keeps the synthetic email in sync when a phone-only account changes phone', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      tokenVersion: 0,
      phone: '+221771111111',
      email: '221771111111@phone.jurali.local',
      emailVerifiedAt: null,
      oauthAccounts: [],
    } as never);
    prismaMock.user.findFirst.mockResolvedValue(null); // new phone is free
    prismaMock.user.update.mockResolvedValue({ phone: '+221772222222' } as never);

    const res = await PATCH(makePatchReq({ phone: '+221772222222' }, { bearer: 'tok' }));
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+221772222222',
          email: '221772222222@phone.jurali.local',
        }),
      }),
    );
  });

  it('does not touch email when a real-email account changes phone', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      tokenVersion: 0,
      phone: '+221771111111',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
      oauthAccounts: [],
    } as never);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({ phone: '+221772222222' } as never);

    const res = await PATCH(makePatchReq({ phone: '+221772222222' }, { bearer: 'tok' }));
    expect(res.status).toBe(200);
    const call = prismaMock.user.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data.email).toBeUndefined();
  });
});
