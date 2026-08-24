import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { POST } from './route';

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
});
