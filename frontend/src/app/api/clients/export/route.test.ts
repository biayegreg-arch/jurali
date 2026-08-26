// Jurali Phase 9 — GET /api/clients/export ("Exporter toutes les dettes",
// Parametres.jsx's "Données" section). Premium-gated like /api/stats.
import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/clients/export');
}

function activeSubscription() {
  return {
    id: 'sub_1',
    ownerId: 'user-1',
    status: 'ACTIVE',
    renewsAt: new Date(Date.now() + 30 * 86_400_000),
    planAmountFcfa: 2500,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
  prismaMock.subscription.findUnique.mockResolvedValue(activeSubscription() as never);
  prismaMock.client.findMany.mockResolvedValue([]);
});

describe('GET /api/clients/export', () => {
  it('401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }) as never,
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('403 PREMIUM_REQUIRED for a free-tier user', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('PREMIUM_REQUIRED');
    expect(prismaMock.client.findMany).not.toHaveBeenCalled();
  });

  it('flattens every client and transaction into rows, scoped to the owner', async () => {
    prismaMock.client.findMany.mockResolvedValue([
      {
        firstName: 'Fatou',
        phone: '+221771234567',
        transactions: [
          {
            type: 'DEBT',
            amountFcfa: 12_500,
            note: 'Riz 5kg',
            createdAt: new Date('2026-08-01T00:00:00Z'),
          },
        ],
      },
      {
        firstName: 'Moussa',
        phone: null,
        transactions: [
          {
            type: 'PAYMENT',
            amountFcfa: 5_000,
            note: null,
            createdAt: new Date('2026-08-02T00:00:00Z'),
          },
        ],
      },
    ] as never);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      items: {
        clientName: string;
        phone: string | null;
        type: string;
        amountFcfa: number;
        note: string | null;
        createdAt: string;
      }[];
    };
    expect(json.items).toHaveLength(2);
    expect(json.items[0]).toMatchObject({
      clientName: 'Fatou',
      phone: '+221771234567',
      type: 'DEBT',
      amountFcfa: 12_500,
      note: 'Riz 5kg',
    });
    expect(json.items[1]).toMatchObject({
      clientName: 'Moussa',
      phone: null,
      type: 'PAYMENT',
      amountFcfa: 5_000,
      note: null,
    });
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user-1' } }),
    );
  });

  it('returns an empty list when the owner has no clients', async () => {
    const res = await GET(makeGet());
    const json = (await res.json()) as { items: unknown[] };
    expect(json.items).toEqual([]);
  });
});
