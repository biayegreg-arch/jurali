// POST /api/coupons/validate — checkout page discount preview.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return {
    ...actual,
    verifyCsrf: vi.fn(),
  };
});

import { requireAuth } from '@/lib/server/middleware';
import { verifyCsrf } from '@/lib/server/auth';
import { POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const mockVerifyCsrf = vi.mocked(verifyCsrf);

const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://test/api/coupons/validate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
  mockVerifyCsrf.mockReturnValue(null);
  prismaMock.platformConfig.findUnique.mockResolvedValue(null); // falls back to 2500 default
});

describe('POST /api/coupons/validate', () => {
  it('rejects CSRF failures before touching the DB', async () => {
    mockVerifyCsrf.mockReturnValue(NextResponse.json({ error: 'CSRF' }, { status: 403 }));
    const res = await POST(makeReq({ code: 'SUMMER20' }));
    expect(res.status).toBe(403);
    expect(prismaMock.coupon.findUnique).not.toHaveBeenCalled();
  });

  it('401s when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) as never,
    );
    const res = await POST(makeReq({ code: 'SUMMER20' }));
    expect(res.status).toBe(401);
  });

  it('400s on a missing code', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('404 COUPON_NOT_FOUND for an unknown code', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ code: 'NOPE' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('COUPON_NOT_FOUND');
  });

  it('404 COUPON_INACTIVE for a deactivated code', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'OFF',
      percentOff: 20,
      active: false,
      expiresAt: null,
    } as never);
    const res = await POST(makeReq({ code: 'OFF' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('COUPON_INACTIVE');
  });

  it('returns the discounted amount for a valid code', async () => {
    prismaMock.coupon.findUnique.mockResolvedValueOnce({
      id: 'c1',
      code: 'SUMMER20',
      percentOff: 20,
      active: true,
      expiresAt: null,
    } as never);

    const res = await POST(makeReq({ code: 'summer20' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      code: string;
      percentOff: number;
      priceFcfa: number;
      discountedAmountFcfa: number;
    };
    expect(body).toEqual({
      code: 'SUMMER20',
      percentOff: 20,
      priceFcfa: 2500,
      discountedAmountFcfa: 2000,
    });
  });
});
