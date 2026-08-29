// GET /api/admin/overview — KPIs + widgets for the "Vue d'ensemble" admin
// dashboard (Banani screen AdminDashboard.jsx). Every number is a real
// aggregate — no fabricated placeholders (see admin-console.md decisions).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { getPremiumMonthlyPriceFcfa } from '@/lib/server/subscriptions/guards';
import {
  bucketMonthlyRevenue,
  getRecentSubscriptionPayments,
  SCAN_LIMIT,
} from '@/lib/server/jurali/admin-revenue';

const RECENT_USERS_LIMIT = 5;
const RECENT_PAYMENTS_LIMIT = 5;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const now = new Date();

    const [totalUsers, activeSubs, priceFcfa, recentUsers, paymentEvents] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.aggregate({
        where: { status: 'ACTIVE', renewsAt: { gt: now } },
        _count: { _all: true },
        _sum: { planAmountFcfa: true },
      }),
      getPremiumMonthlyPriceFcfa(prisma),
      prisma.user.findMany({
        take: RECENT_USERS_LIMIT,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, shopName: true, createdAt: true },
      }),
      getRecentSubscriptionPayments(prisma, SCAN_LIMIT),
    ]);
    const monthlyRevenue = bucketMonthlyRevenue(paymentEvents, 6);
    const recentPayments = paymentEvents.slice(0, RECENT_PAYMENTS_LIMIT);

    const premiumCount = activeSubs._count._all;
    const mrrFcfa = activeSubs._sum.planAmountFcfa ?? 0;
    const freeCount = Math.max(0, totalUsers - premiumCount);
    const conversionRate = totalUsers > 0 ? premiumCount / totalUsers : 0;

    // Only RECENT_USERS_LIMIT (5) rows — per-user queries instead of groupBy
    // keeps this simple/typeable and is cheap at this scale.
    const enrichedRecentUsers = await Promise.all(
      recentUsers.map(async (u) => {
        const [sub, clientCount, debtSum, paymentSum] = await Promise.all([
          prisma.subscription.findUnique({
            where: { ownerId: u.id },
            select: { status: true, renewsAt: true },
          }),
          prisma.client.count({ where: { ownerId: u.id } }),
          prisma.transaction.aggregate({
            where: { ownerId: u.id, type: 'DEBT' },
            _sum: { amountFcfa: true },
          }),
          prisma.transaction.aggregate({
            where: { ownerId: u.id, type: 'PAYMENT' },
            _sum: { amountFcfa: true },
          }),
        ]);
        const isPremium =
          !!sub &&
          sub.status === 'ACTIVE' &&
          !!sub.renewsAt &&
          sub.renewsAt.getTime() > now.getTime();
        // Matches lib/server/jurali/balance.ts's computeClientBalance formula
        // (DEBT adds, PAYMENT subtracts) summed across all of this owner's
        // clients — deliberately NOT clamped to 0, same as that helper: a
        // negative aggregate is a real data anomaly an admin should see, not
        // hide.
        const outstandingBalanceFcfa =
          (debtSum._sum.amountFcfa ?? 0) - (paymentSum._sum.amountFcfa ?? 0);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          shopName: u.shopName,
          createdAt: u.createdAt,
          isPremium,
          clientCount,
          outstandingBalanceFcfa,
        };
      }),
    );

    return NextResponse.json(
      {
        kpis: {
          totalUsers,
          premiumCount,
          freeCount,
          mrrFcfa,
          conversionRate,
          premiumMonthlyPriceFcfa: priceFcfa,
        },
        monthlyRevenue,
        recentUsers: enrichedRecentUsers,
        recentPayments,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
