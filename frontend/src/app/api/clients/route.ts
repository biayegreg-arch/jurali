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
// POST: creates a client. Enforces the PRD §4/§6 free-tier cap (5 clients)
// with a stable 409 CLIENT_LIMIT_REACHED code — waived for a user with an
// active Premium Subscription (Phase 7, `isSubscriptionActive`).
export const runtime = 'nodejs';

import 'server-only';
import { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { listClientSummaries } from '@/lib/server/jurali/clients';
import { zPhone, zEmail } from '@/lib/server/zod-helpers';
import { isSubscriptionActive } from '@/lib/server/subscriptions/guards';
import { parseMonthParam, monthBounds } from '@/lib/server/jurali/month-range';
import { CLIENT_FREE_TIER_LIMIT } from '@/lib/server/jurali/client-limits';
import { lockUserTx } from '@/lib/server/withdrawals/lock';
import { isTransientConflict } from '@/lib/server/prisma-errors';

const Q_MAX_LEN = 200;

const CreateBody = z.object({
  firstName: z.string().trim().min(1).max(120),
  phone: z.union([zPhone, z.literal('')]).optional(),
  // Phase 9 — optional contact fields added for the desktop "Créer client"
  // screen; the mobile create-on-the-fly flow never sends these.
  email: z.union([zEmail, z.literal('')]).optional(),
  address: z.union([z.string().trim().min(1).max(200), z.literal('')]).optional(),
});

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

    // ?month= is OPTIONAL and unrelated to /api/dashboard's own ?month=
    // default-to-current behaviour: absent here means "no filter, show
    // every client" (today's behaviour, unchanged) — a debtor list must
    // never silently hide older unpaid debts. Only a PRESENT value scopes
    // the list to clients with activity that month; a present-but-malformed
    // value still falls back to the current month via parseMonthParam.
    const monthParam = url.searchParams.get('month');
    const monthWhere = monthParam
      ? (() => {
          const { year, month } = parseMonthParam(monthParam);
          const { start, end } = monthBounds(year, month);
          return { transactions: { some: { createdAt: { gte: start, lt: end } } } };
        })()
      : {};

    const summarized = await listClientSummaries(auth.user.sub, {
      ...monthWhere,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    });

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

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Count-then-create was a TOCTOU race: two concurrent POSTs at
          // 4/5 clients could both pass the cap check. The lock serializes
          // them so the second sees the first's just-created row.
          await lockUserTx(tx, auth.user.sub);

          const existingCount = await tx.client.count({ where: { ownerId: auth.user.sub } });
          if (existingCount >= CLIENT_FREE_TIER_LIMIT) {
            const subscription = await tx.subscription.findUnique({
              where: { ownerId: auth.user.sub },
            });
            if (!isSubscriptionActive(subscription)) {
              return { ok: false as const };
            }
          }

          const created = await tx.client.create({
            data: {
              ownerId: auth.user.sub,
              firstName: parsed.data.firstName,
              phone: parsed.data.phone || null,
              email: parsed.data.email || null,
              address: parsed.data.address || null,
            },
            select: {
              id: true,
              firstName: true,
              phone: true,
              email: true,
              address: true,
              createdAt: true,
            },
          });

          return { ok: true as const, client: created };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (!result.ok) {
        return NextResponse.json(
          {
            error: 'CLIENT_LIMIT_REACHED',
            message: `Free tier is limited to ${CLIENT_FREE_TIER_LIMIT} clients.`,
          },
          { status: 409, headers: { 'x-request-id': ctx.requestId } },
        );
      }

      return NextResponse.json(
        {
          ...result.client,
          balanceFcfa: 0,
          isOverdue: false,
          lastActivityAt: null,
          lastNote: null,
        },
        { status: 201, headers: { 'x-request-id': ctx.requestId } },
      );
    } catch (err) {
      if (isTransientConflict(err)) {
        return NextResponse.json(
          { error: 'TRANSIENT_CONFLICT', message: 'Please retry' },
          { status: 409, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }
  });
}
