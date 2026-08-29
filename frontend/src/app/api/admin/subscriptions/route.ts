// GET /api/admin/subscriptions — list all Premium subscriptions for the
// "Abonnements" admin page (status/plan filters, cursor pagination), also
// used by the Utilisateurs "Gérer" panel via ?ownerId= to fetch a single
// user's subscription (Subscription.ownerId is unique, so this returns at
// most one row).
//
// Mirrors the users-list pattern. `isActive` is computed the same way the
// public GET /api/subscriptions does (status===ACTIVE && renewsAt in the
// future) — admins should never see a stale ACTIVE badge for a lapsed row.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { isSubscriptionActive } from '@/lib/server/subscriptions/guards';

const SUBSCRIPTION_SELECT = {
  id: true,
  ownerId: true,
  status: true,
  renewsAt: true,
  planAmountFcfa: true,
  paymentMethod: true,
  createdAt: true,
  owner: { select: { email: true, name: true, shopName: true } },
} as const satisfies Prisma.SubscriptionSelect;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const status = url.searchParams.get('status');
    const ownerId = url.searchParams.get('ownerId');
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.SubscriptionWhereInput = {
      ...(status ? { status } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.subscription.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: SUBSCRIPTION_SELECT,
    });

    const page = buildPage(rows, limit);
    return NextResponse.json(
      {
        items: page.items.map((s) => ({ ...s, isActive: isSubscriptionActive(s) })),
        nextCursor: page.nextCursor,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
