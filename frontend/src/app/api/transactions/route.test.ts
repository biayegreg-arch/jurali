import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/server/withdrawals/lock', () => ({ lockUserTx: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { lockUserTx } from '@/lib/server/withdrawals/lock';
import { POST } from './route';

const mockLockUserTx = vi.mocked(lockUserTx);
const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makePost(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if ((opts.csrf ?? 'match') === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/transactions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx);
  // Default $transaction passes the prismaMock as `tx` so writes within the
  // callback hit the same mocks as the outer client (mockDeep proxies them).
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('POST /api/transactions', () => {
  it('returns 403 when CSRF token is missing', async () => {
    const res = await POST(
      makePost({ clientId: 'c-1', type: 'DEBT', amountFcfa: 1000 }, { csrf: 'missing' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 VALIDATION_FAILED for a non-positive amount', async () => {
    const res = await POST(makePost({ clientId: 'c-1', type: 'DEBT', amountFcfa: 0 }));
    expect(res.status).toBe(400);
  });

  it('returns 404 CLIENT_NOT_FOUND when the client does not exist', async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    const res = await POST(makePost({ clientId: 'missing', type: 'DEBT', amountFcfa: 1000 }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the client belongs to a different owner', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      ownerId: 'someone-else',
      transactions: [],
    } as never);
    const res = await POST(makePost({ clientId: 'c-1', type: 'DEBT', amountFcfa: 1000 }));
    expect(res.status).toBe(404);
  });

  it('creates a DEBT transaction and returns 201', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      ownerId: 'user-1',
      transactions: [],
    } as never);
    prismaMock.transaction.create.mockResolvedValue({
      id: 'tx-1',
      clientId: 'c-1',
      type: 'DEBT',
      amountFcfa: 12_500,
      note: 'Riz 5kg',
      createdAt: new Date('2026-08-24T10:00:00Z'),
    } as never);

    const res = await POST(
      makePost({ clientId: 'c-1', type: 'DEBT', amountFcfa: 12_500, note: 'Riz 5kg' }),
    );
    expect(res.status).toBe(201);
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'c-1',
          ownerId: 'user-1',
          type: 'DEBT',
          amountFcfa: 12_500,
        }),
      }),
    );
  });

  it('accepts a PAYMENT that exactly matches the current balance', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      ownerId: 'user-1',
      transactions: [{ type: 'DEBT', amountFcfa: 5_000 }],
    } as never);
    prismaMock.transaction.create.mockResolvedValue({
      id: 'tx-2',
      clientId: 'c-1',
      type: 'PAYMENT',
      amountFcfa: 5_000,
      note: null,
      createdAt: new Date(),
    } as never);

    const res = await POST(makePost({ clientId: 'c-1', type: 'PAYMENT', amountFcfa: 5_000 }));
    expect(res.status).toBe(201);
  });

  it('rejects a PAYMENT that exceeds the current balance with 422 PAYMENT_EXCEEDS_BALANCE', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      ownerId: 'user-1',
      transactions: [{ type: 'DEBT', amountFcfa: 5_000 }],
    } as never);

    const res = await POST(makePost({ clientId: 'c-1', type: 'PAYMENT', amountFcfa: 5_001 }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  describe('markOverdueOnly (server-recomputed amount, ignores a stale client clock)', () => {
    it('ignores the client-submitted amountFcfa and uses the server-computed overdue balance', async () => {
      const oldDebt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      prismaMock.client.findUnique.mockResolvedValue({
        ownerId: 'user-1',
        transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: oldDebt }],
      } as never);
      prismaMock.transaction.create.mockResolvedValue({
        id: 'tx-3',
        clientId: 'c-1',
        type: 'PAYMENT',
        amountFcfa: 12_500,
        note: null,
        createdAt: new Date(),
      } as never);

      // A device with a wrong clock submits a bogus amount — the server
      // must recompute it from its own `now`, not trust this value.
      const res = await POST(
        makePost({
          clientId: 'c-1',
          type: 'PAYMENT',
          amountFcfa: 999_999,
          markOverdueOnly: true,
        }),
      );
      expect(res.status).toBe(201);
      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amountFcfa: 12_500 }) }),
      );
    });

    it('returns 422 NOTHING_OVERDUE when no debt is actually overdue', async () => {
      const recentDebt = new Date();
      prismaMock.client.findUnique.mockResolvedValue({
        ownerId: 'user-1',
        transactions: [{ type: 'DEBT', amountFcfa: 12_500, createdAt: recentDebt }],
      } as never);

      const res = await POST(
        makePost({
          clientId: 'c-1',
          type: 'PAYMENT',
          amountFcfa: 12_500,
          markOverdueOnly: true,
        }),
      );
      expect(res.status).toBe(422);
      expect((await res.json()).error).toBe('NOTHING_OVERDUE');
      expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    });
  });

  it('guards the balance-check-then-insert race with the per-user advisory lock', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      ownerId: 'user-1',
      transactions: [],
    } as never);
    prismaMock.transaction.create.mockResolvedValue({
      id: 'tx-1',
      clientId: 'c-1',
      type: 'DEBT',
      amountFcfa: 1_000,
      note: null,
      createdAt: new Date(),
    } as never);

    await POST(makePost({ clientId: 'c-1', type: 'DEBT', amountFcfa: 1_000 }));

    expect(mockLockUserTx).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('returns 409 TRANSIENT_CONFLICT when the Serializable transaction aborts (P2034)', async () => {
    prismaMock.$transaction.mockRejectedValue(
      Object.assign(new Error('conflict'), { code: 'P2034' }),
    );

    const res = await POST(makePost({ clientId: 'c-1', type: 'DEBT', amountFcfa: 1_000 }));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('TRANSIENT_CONFLICT');
  });
});
