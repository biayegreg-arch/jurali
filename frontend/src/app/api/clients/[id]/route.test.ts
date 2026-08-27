import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET, PATCH, DELETE } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(id: string): { req: NextRequest; routeCtx: { params: Promise<{ id: string }> } } {
  return {
    req: new NextRequest(`http://test/api/clients/${id}`),
    routeCtx: { params: Promise.resolve({ id }) },
  };
}

function makeDelete(
  id: string,
  opts: { csrf?: 'match' | 'missing' } = {},
): { req: NextRequest; routeCtx: { params: Promise<{ id: string }> } } {
  const headers: Record<string, string> = {};
  if ((opts.csrf ?? 'match') === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return {
    req: new NextRequest(`http://test/api/clients/${id}`, { method: 'DELETE', headers }),
    routeCtx: { params: Promise.resolve({ id }) },
  };
}

function makePatch(
  id: string,
  body: unknown,
  opts: { csrf?: 'match' | 'missing' } = {},
): { req: NextRequest; routeCtx: { params: Promise<{ id: string }> } } {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if ((opts.csrf ?? 'match') === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return {
    req: new NextRequest(`http://test/api/clients/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    }),
    routeCtx: { params: Promise.resolve({ id }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('GET /api/clients/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(401);
  });

  it('returns 404 CLIENT_NOT_FOUND when the client does not exist', async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    const { req, routeCtx } = makeGet('missing');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('CLIENT_NOT_FOUND');
  });

  it('returns 404 (not 403) when the client belongs to a different owner', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'someone-else',
      firstName: 'Fatou',
      phone: null,
      createdAt: new Date(),
      transactions: [],
    } as never);
    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(404);
  });

  it('returns balance, isOverdue and history most-recent-first', async () => {
    const newer = new Date('2026-08-20T10:00:00Z');
    const older = new Date('2026-08-01T10:00:00Z');
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'user-1',
      firstName: 'Fatou',
      phone: '+221771234567',
      createdAt: older,
      lastReminderSentAt: null,
      transactions: [
        { id: 'tx-2', type: 'DEBT', amountFcfa: 5_000, note: null, createdAt: newer },
        { id: 'tx-1', type: 'DEBT', amountFcfa: 12_500, note: 'Riz 5kg', createdAt: older },
      ],
    } as never);

    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      balanceFcfa: number;
      transactions: { id: string }[];
    };
    expect(json.balanceFcfa).toBe(17_500);
    // most recent first, as returned by the orderBy: createdAt desc query
    expect(json.transactions.map((t) => t.id)).toEqual(['tx-2', 'tx-1']);
  });

  it('returns lastReminderSentAt when a Phase 8 reminder was sent', async () => {
    const sentAt = new Date('2026-08-24T09:00:00Z');
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'user-1',
      firstName: 'Fatou',
      phone: '+221771234567',
      createdAt: new Date('2026-08-01T10:00:00Z'),
      lastReminderSentAt: sentAt,
      transactions: [],
    } as never);

    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    const json = (await res.json()) as { lastReminderSentAt: string };
    expect(json.lastReminderSentAt).toBe(sentAt.toISOString());
  });

  it('Phase 9 — returns email + address', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'user-1',
      firstName: 'Fatou',
      phone: '+221771234567',
      email: 'fatou@example.com',
      address: 'Médina, Dakar',
      createdAt: new Date(),
      lastReminderSentAt: null,
      transactions: [],
    } as never);

    const { req, routeCtx } = makeGet('client-1');
    const res = await GET(req, routeCtx);
    const json = (await res.json()) as { email: string; address: string };
    expect(json.email).toBe('fatou@example.com');
    expect(json.address).toBe('Médina, Dakar');
  });
});

describe('PATCH /api/clients/[id]', () => {
  beforeEach(() => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'user-1',
    } as never);
    prismaMock.client.update.mockResolvedValue({
      id: 'client-1',
      firstName: 'Fatou Updated',
      phone: '+221771234567',
      email: 'fatou@example.com',
      address: 'Médina, Dakar',
    } as never);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const { req, routeCtx } = makePatch('client-1', { firstName: 'X' });
    const res = await PATCH(req, routeCtx);
    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF token is missing', async () => {
    const { req, routeCtx } = makePatch('client-1', { firstName: 'X' }, { csrf: 'missing' });
    const res = await PATCH(req, routeCtx);
    expect(res.status).toBe(403);
  });

  it('returns 404 CLIENT_NOT_FOUND when the client does not exist', async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    const { req, routeCtx } = makePatch('missing', { firstName: 'X' });
    const res = await PATCH(req, routeCtx);
    expect(res.status).toBe(404);
  });

  it('returns 404 (not 403) when the client belongs to a different owner', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'someone-else',
    } as never);
    const { req, routeCtx } = makePatch('client-1', { firstName: 'X' });
    const res = await PATCH(req, routeCtx);
    expect(res.status).toBe(404);
  });

  it('returns 400 VALIDATION_FAILED for an empty firstName', async () => {
    const { req, routeCtx } = makePatch('client-1', { firstName: '' });
    const res = await PATCH(req, routeCtx);
    expect(res.status).toBe(400);
  });

  it('returns 400 VALIDATION_FAILED for a malformed email', async () => {
    const { req, routeCtx } = makePatch('client-1', { email: 'not-an-email' });
    const res = await PATCH(req, routeCtx);
    expect(res.status).toBe(400);
  });

  it('updates firstName/phone/email/address and returns the updated client', async () => {
    const { req, routeCtx } = makePatch('client-1', {
      firstName: 'Fatou Updated',
      phone: '+221771234567',
      email: 'fatou@example.com',
      address: 'Médina, Dakar',
    });
    const res = await PATCH(req, routeCtx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { firstName: string; email: string; address: string };
    expect(json.firstName).toBe('Fatou Updated');
    expect(json.email).toBe('fatou@example.com');
    expect(json.address).toBe('Médina, Dakar');
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'client-1' },
        data: expect.objectContaining({
          firstName: 'Fatou Updated',
          phone: '+221771234567',
          email: 'fatou@example.com',
          address: 'Médina, Dakar',
        }),
      }),
    );
  });

  it('allows clearing email/address by sending an empty string', async () => {
    const { req, routeCtx } = makePatch('client-1', { email: '', address: '' });
    await PATCH(req, routeCtx);
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: null, address: null }),
      }),
    );
  });

  it('only updates the fields provided (partial update)', async () => {
    const { req, routeCtx } = makePatch('client-1', { address: 'Plateau, Dakar' });
    await PATCH(req, routeCtx);
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { address: 'Plateau, Dakar' },
      }),
    );
  });
});

describe('DELETE /api/clients/[id]', () => {
  beforeEach(() => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'user-1',
    } as never);
    prismaMock.client.delete.mockResolvedValue({ id: 'client-1' } as never);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const { req, routeCtx } = makeDelete('client-1');
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(401);
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF token is missing', async () => {
    const { req, routeCtx } = makeDelete('client-1', { csrf: 'missing' });
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(403);
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it('returns 404 CLIENT_NOT_FOUND when the client does not exist', async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    const { req, routeCtx } = makeDelete('missing');
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(404);
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it('returns 404 (not 403) when the client belongs to a different owner', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: 'client-1',
      ownerId: 'someone-else',
    } as never);
    const { req, routeCtx } = makeDelete('client-1');
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(404);
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it('deletes the client and returns 200 { ok: true }', async () => {
    const { req, routeCtx } = makeDelete('client-1');
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    expect(prismaMock.client.delete).toHaveBeenCalledWith({ where: { id: 'client-1' } });
  });
});
