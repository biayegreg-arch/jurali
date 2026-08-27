// Jurali Phase 7 — GET/POST /api/subscriptions tests.
// Mirrors src/app/api/orders/route.test.ts's mocking scaffold (prisma-mock
// first, mockNextCookies, requireAuth + provider-singleton mocked), adapted
// for the one-row-per-owner replay model (no client Idempotency-Key).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/server/withdrawals/lock', () => ({ lockUserTx: vi.fn() }));

vi.mock('@/lib/server/payments/provider-singleton', () => ({
  getProvider: vi.fn(),
  breaker: { execute: vi.fn() },
  PaymentProviderUnconfiguredError: class PaymentProviderUnconfiguredError extends Error {
    constructor() {
      super('Payment provider not configured');
      this.name = 'PaymentProviderUnconfiguredError';
    }
  },
  __resetProviderSingleton: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import {
  getProvider,
  breaker,
  PaymentProviderUnconfiguredError,
} from '@/lib/server/payments/provider-singleton';
import { CircuitOpenError } from '@/lib/server/payments/circuit-breaker';
import { lockUserTx } from '@/lib/server/withdrawals/lock';
import { GET, POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetProvider = vi.mocked(getProvider);
const mockExecute = vi.mocked(breaker.execute);
const mockLockUserTx = vi.mocked(lockUserTx);

const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/subscriptions', { method: 'GET' });
}

function makePost(csrf: 'match' | 'missing' = 'match'): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/subscriptions', { method: 'POST', headers });
}

function seededSub(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sub_1',
    ownerId: 'user-1',
    status: 'PENDING',
    renewsAt: null,
    planAmountFcfa: 2500,
    provider: null,
    providerChargeId: null,
    paymentUrl: null,
    createdAt: new Date('2026-08-24T12:00:00Z'),
    updatedAt: new Date('2026-08-24T12:00:00Z'),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BICTORYS_API_URL = 'https://api.test.bictorys.local';
  process.env.BICTORYS_API_KEY = 'test-key';
  process.env.BICTORYS_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.PUBLIC_URL = 'http://localhost:3000';

  mockRequireAuth.mockResolvedValue(authedCtx as never);
  mockGetProvider.mockReturnValue({
    name: 'bictorys',
    charge: vi.fn(async () => ({
      providerChargeId: 'bictorys_charge_sub_1',
      paymentUrl: 'https://checkout.test/bictorys/pay/sub',
      status: 'PENDING' as const,
    })),
  } as never);
  mockExecute.mockImplementation(async (fn: () => unknown) => fn());
  // Default $transaction passes the prismaMock as `tx` so writes within the
  // callback hit the same mocks as the outer client (mockDeep proxies them).
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('GET /api/subscriptions', () => {
  it('reports NONE when the user has never subscribed', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'NONE', isActive: false, planAmountFcfa: 2500 });
  });

  it('reports isActive:true for an ACTIVE subscription with a future renewsAt', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      seededSub({ status: 'ACTIVE', renewsAt: new Date(Date.now() + 30 * 86_400_000) }) as never,
    );
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ACTIVE', isActive: true });
  });

  it('reports isActive:false for a lapsed ACTIVE subscription (renewsAt passed)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      seededSub({ status: 'ACTIVE', renewsAt: new Date(Date.now() - 86_400_000) }) as never,
    );
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ACTIVE', isActive: false });
  });
});

describe('POST /api/subscriptions — happy path', () => {
  it('creates a PENDING subscription and returns 201 + paymentUrl for a first-time checkout', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue(seededSub() as never);
    prismaMock.subscription.update.mockResolvedValue(seededSub() as never);

    const res = await POST(makePost());

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      status: 'PENDING',
      paymentUrl: 'https://checkout.test/bictorys/pay/sub',
    });
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user-1' } }),
    );
  });

  it('guards the read-then-upsert gate with the per-user advisory lock (prevents double-charge race)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue(seededSub() as never);
    prismaMock.subscription.update.mockResolvedValue(seededSub() as never);

    await POST(makePost());

    expect(mockLockUserTx).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('returns 409 TRANSIENT_CONFLICT when the gate transaction aborts (P2034), without charging', async () => {
    prismaMock.$transaction.mockRejectedValue(
      Object.assign(new Error('conflict'), { code: 'P2034' }),
    );

    const res = await POST(makePost());

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('TRANSIENT_CONFLICT');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('allows re-checkout after a CANCELED subscription', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      seededSub({ status: 'CANCELED' }) as never,
    );
    prismaMock.subscription.upsert.mockResolvedValue(seededSub({ status: 'PENDING' }) as never);
    prismaMock.subscription.update.mockResolvedValue(seededSub() as never);

    const res = await POST(makePost());
    expect(res.status).toBe(201);
  });
});

describe('POST /api/subscriptions — replay + guard branches', () => {
  it('409 ALREADY_SUBSCRIBED when an ACTIVE subscription is still within its period', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      seededSub({ status: 'ACTIVE', renewsAt: new Date(Date.now() + 86_400_000) }) as never,
    );
    const res = await POST(makePost());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('ALREADY_SUBSCRIBED');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('replays the existing paymentUrl (200) for a PENDING checkout already in flight', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      seededSub({ paymentUrl: 'https://checkout.test/prior' }) as never,
    );
    const res = await POST(makePost());
    expect(res.status).toBe(200);
    expect((await res.json()).paymentUrl).toBe('https://checkout.test/prior');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('503 PAYMENT_IN_FLIGHT for a PENDING row with no paymentUrl (crash race)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(seededSub({ paymentUrl: null }) as never);
    const res = await POST(makePost());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_IN_FLIGHT');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('403 when CSRF token is missing', async () => {
    const res = await POST(makePost('missing'));
    expect(res.status).toBe(403);
  });

  it('401 when unauthenticated', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) as never,
    );
    const res = await POST(makePost());
    expect(res.status).toBe(401);
  });
});

describe('POST /api/subscriptions — provider failure branches', () => {
  it('503 PAYMENT_PROVIDER_UNCONFIGURED when Bictorys env is missing', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    mockGetProvider.mockImplementation(() => {
      throw new PaymentProviderUnconfiguredError();
    });
    const res = await POST(makePost());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_PROVIDER_UNCONFIGURED');
  });

  it('503 PAYMENT_PROVIDER_UNAVAILABLE + marks FAILED on CircuitOpenError', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue(seededSub() as never);
    prismaMock.subscription.update.mockResolvedValue(seededSub({ status: 'FAILED' }) as never);
    mockExecute.mockRejectedValue(
      new CircuitOpenError('bictorys.charge', new Date(Date.now() + 5000)),
    );

    const res = await POST(makePost());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });

  it('502 PAYMENT_FAILED + marks FAILED when provider.charge throws', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue(seededSub() as never);
    prismaMock.subscription.update.mockResolvedValue(seededSub({ status: 'FAILED' }) as never);
    mockExecute.mockRejectedValue(new Error('network down'));

    const res = await POST(makePost());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('PAYMENT_FAILED');
  });
});
