import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/server/withdrawals/lock', () => ({ lockUserTx: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { lockUserTx } from '@/lib/server/withdrawals/lock';
import { PATCH } from './route';

const mockLockUserTx = vi.mocked(lockUserTx);
const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makePatch(body: unknown, opts: { csrf?: 'match' | 'missing' } = {}): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if ((opts.csrf ?? 'match') === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/transactions/tx-1', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

function callPatch(body: unknown, id = 'tx-1', opts?: { csrf?: 'match' | 'missing' }) {
  return PATCH(makePatch(body, opts), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx);
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('PATCH /api/transactions/[id]', () => {
  it('returns 403 when CSRF token is missing', async () => {
    const res = await callPatch({ amountFcfa: 1_000 }, 'tx-1', { csrf: 'missing' });
    expect(res.status).toBe(403);
  });

  it('returns 400 VALIDATION_FAILED for a non-positive amount', async () => {
    const res = await callPatch({ amountFcfa: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 TRANSACTION_NOT_FOUND when the transaction does not exist', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    const res = await callPatch({ amountFcfa: 1_000 });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('TRANSACTION_NOT_FOUND');
  });

  it('returns 404 when the transaction belongs to a different owner', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      ownerId: 'someone-else',
      clientId: 'c-1',
      type: 'PAYMENT',
    } as never);
    const res = await callPatch({ amountFcfa: 1_000 });
    expect(res.status).toBe(404);
  });

  it('returns 422 ONLY_PAYMENTS_EDITABLE for a DEBT row', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      ownerId: 'user-1',
      clientId: 'c-1',
      type: 'DEBT',
    } as never);
    const res = await callPatch({ amountFcfa: 1_000 });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ONLY_PAYMENTS_EDITABLE');
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('updates a PAYMENT amount that stays within the balance excluding itself', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      ownerId: 'user-1',
      clientId: 'c-1',
      type: 'PAYMENT',
    } as never);
    // Debt 33_750, this payment corrected from 10_000 -> 15_000. Balance
    // excluding this payment (siblings only) = 33_750 (the DEBT alone).
    prismaMock.transaction.findMany.mockResolvedValue([
      { type: 'DEBT', amountFcfa: 33_750 },
    ] as never);
    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx-1',
      clientId: 'c-1',
      type: 'PAYMENT',
      amountFcfa: 15_000,
      note: null,
      createdAt: new Date('2026-09-14T10:00:00Z'),
    } as never);

    const res = await callPatch({ amountFcfa: 15_000 });
    expect(res.status).toBe(200);
    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1' },
        data: { amountFcfa: 15_000 },
      }),
    );
    const json = (await res.json()) as { amountFcfa: number };
    expect(json.amountFcfa).toBe(15_000);
  });

  it('rejects a corrected amount that would exceed the balance with 422 PAYMENT_EXCEEDS_BALANCE', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      ownerId: 'user-1',
      clientId: 'c-1',
      type: 'PAYMENT',
    } as never);
    prismaMock.transaction.findMany.mockResolvedValue([
      { type: 'DEBT', amountFcfa: 33_750 },
    ] as never);

    const res = await callPatch({ amountFcfa: 40_000 });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('excludes the edited payment itself from the balance check (raising its own amount within room is fine)', async () => {
    // DEBT 10_000, another PAYMENT of 2_000 already recorded, and this
    // payment (currently 3_000) being corrected up to 8_000. Balance
    // excluding this row = 10_000 - 2_000 = 8_000, so 8_000 is exactly ok.
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      ownerId: 'user-1',
      clientId: 'c-1',
      type: 'PAYMENT',
    } as never);
    prismaMock.transaction.findMany.mockResolvedValue([
      { type: 'DEBT', amountFcfa: 10_000 },
      { type: 'PAYMENT', amountFcfa: 2_000 },
    ] as never);
    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx-1',
      clientId: 'c-1',
      type: 'PAYMENT',
      amountFcfa: 8_000,
      note: null,
      createdAt: new Date(),
    } as never);

    const res = await callPatch({ amountFcfa: 8_000 });
    expect(res.status).toBe(200);
  });

  it('guards the balance-check-then-update race with the per-user advisory lock', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      ownerId: 'user-1',
      clientId: 'c-1',
      type: 'PAYMENT',
    } as never);
    prismaMock.transaction.findMany.mockResolvedValue([
      { type: 'DEBT', amountFcfa: 33_750 },
    ] as never);
    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx-1',
      clientId: 'c-1',
      type: 'PAYMENT',
      amountFcfa: 15_000,
      note: null,
      createdAt: new Date(),
    } as never);

    await callPatch({ amountFcfa: 15_000 });

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

    const res = await callPatch({ amountFcfa: 1_000 });

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('TRANSIENT_CONFLICT');
  });
});
