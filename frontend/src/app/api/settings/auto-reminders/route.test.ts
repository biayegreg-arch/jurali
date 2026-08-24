import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { GET, PATCH } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/settings/auto-reminders');
}

function makePatch(body: unknown, csrf: 'match' | 'missing' = 'match'): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (csrf === 'match') {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/settings/auto-reminders', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
});

describe('GET /api/settings/auto-reminders', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) as never,
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('returns the current toggle state', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ autoReminderEnabled: true } as never);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(true);
  });

  it('defaults to false when the user row is missing (defensive)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect((await res.json()).enabled).toBe(false);
  });
});

describe('PATCH /api/settings/auto-reminders', () => {
  it('403 when CSRF token is missing', async () => {
    const res = await PATCH(makePatch({ enabled: true }, 'missing'));
    expect(res.status).toBe(403);
  });

  it('400 on an invalid body', async () => {
    const res = await PATCH(makePatch({ enabled: 'yes' }));
    expect(res.status).toBe(400);
  });

  it('updates the toggle and returns the new state', async () => {
    prismaMock.user.update.mockResolvedValue({ autoReminderEnabled: true } as never);
    const res = await PATCH(makePatch({ enabled: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).enabled).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { autoReminderEnabled: true },
      select: { autoReminderEnabled: true },
    });
  });
});
