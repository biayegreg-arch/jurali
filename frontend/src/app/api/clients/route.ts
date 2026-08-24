// GET/POST /api/clients — Jurali client list + creation.
//
// GET: search (?q=) + sort (?sort=amount|activity, ?order=asc|desc) + cap
// (?limit=). Balance and "last activity" are DERIVED from Transaction rows
// (see Phase 1 balance.ts), not stored columns, so sorting/filtering happens
// in application code after a single findMany with transactions included.
// This is deliberately not cursor-paginated like the admin listings — a
// single shopkeeper's client list is bounded (free tier caps at 10; even
// Premium is realistically tens to a couple hundred rows per PRD §2/§6),
// so an in-memory sort avoids building computed-column SQL for no real
// scale benefit (YAGNI).
//
// POST: creates a client. Enforces the PRD §4/§6 free-tier cap (10 clients)
// with a stable 409 CLIENT_LIMIT_REACHED code — Phase 7 will gate this
// behind an active Subscription; today every user is on the free tier since
// no Subscription model exists yet.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance, isOverdue as computeIsOverdue } from '@/lib/server/jurali/balance';
import { zPhone } from '@/lib/server/zod-helpers';

const CLIENT_FREE_TIER_LIMIT = 10;
const Q_MAX_LEN = 200;

const CreateBody = z.object({
  firstName: z.string().trim().min(1).max(120),
  phone: z.union([zPhone, z.literal('')]).optional(),
});

const TX_SELECT = { type: true, amountFcfa: true, note: true, createdAt: true } as const;

function summarizeClient(client: {
  id: string;
  firstName: string;
  phone: string | null;
  transactions: { type: string; amountFcfa: number; note: string | null; createdAt: Date }[];
}) {
  // Ascending for the FIFO balance/aging helpers (Phase 1 contract). Prisma's
  // `type` column is a plain String (not a native enum — see schema.prisma
  // comment), so it comes back as `string`; cast once here since every row
  // was written through the `type: z.enum(['DEBT', 'PAYMENT'])` contract in
  // POST /api/transactions.
  const chronological = [...client.transactions]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' }));
  const balanceFcfa = computeClientBalance(chronological);
  const overdue = computeIsOverdue(chronological);
  const last = chronological[chronological.length - 1] ?? null;

  return {
    id: client.id,
    firstName: client.firstName,
    phone: client.phone,
    balanceFcfa,
    isOverdue: overdue,
    lastActivityAt: last ? last.createdAt.toISOString() : null,
    lastNote: last?.note ?? null,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const q = (url.searchParams.get('q') ?? '').slice(0, Q_MAX_LEN).trim();
    const sort = url.searchParams.get('sort') === 'amount' ? 'amount' : 'activity';
    const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : null;

    const rows = await prisma.client.findMany({
      where: {
        ownerId: auth.user.sub,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        phone: true,
        transactions: { select: TX_SELECT },
      },
    });

    const summarized = rows.map(summarizeClient);

    summarized.sort((a, b) => {
      const dir = order === 'asc' ? 1 : -1;
      if (sort === 'amount') return (a.balanceFcfa - b.balanceFcfa) * dir;
      // activity: null (never touched) sorts last regardless of direction.
      const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : -Infinity;
      const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : -Infinity;
      return (aTime - bTime) * dir;
    });

    const items = limit ? summarized.slice(0, limit) : summarized;
    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const existingCount = await prisma.client.count({ where: { ownerId: auth.user.sub } });
    if (existingCount >= CLIENT_FREE_TIER_LIMIT) {
      return NextResponse.json(
        {
          error: 'CLIENT_LIMIT_REACHED',
          message: `Free tier is limited to ${CLIENT_FREE_TIER_LIMIT} clients.`,
        },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const client = await prisma.client.create({
      data: {
        ownerId: auth.user.sub,
        firstName: parsed.data.firstName,
        phone: parsed.data.phone || null,
      },
      select: { id: true, firstName: true, phone: true, createdAt: true },
    });

    return NextResponse.json(
      { ...client, balanceFcfa: 0, isOverdue: false, lastActivityAt: null, lastNote: null },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
