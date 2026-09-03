// GET /api/admin/revenue — "Revenus" admin page: MRR, monthly history, and
// a fuller recent-payments list than the dashboard widget. See
// lib/server/jurali/admin-revenue.ts — backed by the SubscriptionPayment
// ledger (prisma/schema.prisma).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import {
  bucketMonthlyRevenue,
  getRecentSubscriptionPayments,
  SCAN_LIMIT,
} from '@/lib/server/jurali/admin-revenue';

const PAYMENTS_LIMIT = 30;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const now = new Date();
    const [activeAgg, paymentEvents] = await Promise.all([
      prisma.subscription.aggregate({
        where: { status: 'ACTIVE', renewsAt: { gt: now } },
        _count: { _all: true },
        _sum: { planAmountFcfa: true },
      }),
      getRecentSubscriptionPayments(prisma, SCAN_LIMIT),
    ]);
    const monthlyRevenue = bucketMonthlyRevenue(paymentEvents, 6);
    const payments = paymentEvents.slice(0, PAYMENTS_LIMIT);

    const paidCount = payments.filter((p) => p.status === 'PAID').length;
    const failedCount = payments.filter((p) => p.status === 'FAILED').length;

    return NextResponse.json(
      {
        mrrFcfa: activeAgg._sum.planAmountFcfa ?? 0,
        activeSubscriptionCount: activeAgg._count._all,
        monthlyRevenue,
        payments,
        paidCount,
        failedCount,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
