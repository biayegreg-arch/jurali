// GET /api/stats — Banani's `StatisticsDesktop` screen. Premium-gated like
// POST /api/clients/[id]/remind (confirmed 2026-08-26 — /premium already
// advertises "Statistiques avancées" as Premium-exclusive, so this mirrors
// that promise rather than inventing a new gating story).
//
// Reuses listClientSummaries (same as /api/dashboard and /api/clients) so
// totalDueFcfa/debtorCount/overdueDueFcfa/overdueDebtorCount can't drift
// from what those two endpoints already show. totalPaidFcfa is a lifetime
// (unbounded) PAYMENT sum — distinct from /api/dashboard's calendar-month
// recoveredThisMonthFcfa — because recoveryRatePercent is meant to answer
// "of everything ever owed, how much have I recovered", not a monthly
// snapshot.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { requirePremium } from '@/lib/server/subscriptions/guards';
import { listClientSummaries } from '@/lib/server/jurali/clients';
import { monthBounds, shiftMonth } from '@/lib/server/jurali/month-range';
import { computeRecoveryRatePercent, bucketMonthlyTrend } from '@/lib/server/jurali/stats';

const TREND_MONTHS = 6;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const premiumFail = await requirePremium(
      prisma,
      auth.user.sub,
      ctx.requestId,
      'Statistics require an active Premium subscription.',
    );
    if (premiumFail) return premiumFail;

    const summaries = await listClientSummaries(auth.user.sub);

    let totalDueFcfa = 0;
    let debtorCount = 0;
    let overdueDueFcfa = 0;
    let overdueDebtorCount = 0;
    for (const s of summaries) {
      if (s.balanceFcfa <= 0) continue;
      totalDueFcfa += s.balanceFcfa;
      debtorCount += 1;
      if (s.isOverdue) {
        overdueDueFcfa += s.balanceFcfa;
        overdueDebtorCount += 1;
      }
    }
    const averageDebtFcfa = debtorCount > 0 ? Math.round(totalDueFcfa / debtorCount) : 0;

    const totalPaid = await prisma.transaction.aggregate({
      where: { ownerId: auth.user.sub, type: 'PAYMENT' },
      _sum: { amountFcfa: true },
    });
    const totalPaidFcfa = totalPaid._sum.amountFcfa ?? 0;
    const recoveryRatePercent = computeRecoveryRatePercent(totalPaidFcfa, totalDueFcfa);

    const now = new Date();
    const months = Array.from({ length: TREND_MONTHS }, (_, i) =>
      shiftMonth(now.getFullYear(), now.getMonth(), i - (TREND_MONTHS - 1)),
    );
    const windowStart = monthBounds(months[0]!.year, months[0]!.month).start;
    const windowEnd = monthBounds(
      months[months.length - 1]!.year,
      months[months.length - 1]!.month,
    ).end;
    const trendTransactions = await prisma.transaction.findMany({
      where: { ownerId: auth.user.sub, createdAt: { gte: windowStart, lt: windowEnd } },
      select: { type: true, amountFcfa: true, createdAt: true },
    });
    const monthlyTrend = bucketMonthlyTrend(
      trendTransactions.map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' })),
      months,
    );

    return NextResponse.json(
      {
        totalDueFcfa,
        debtorCount,
        overdueDueFcfa,
        overdueDebtorCount,
        averageDebtFcfa,
        totalPaidFcfa,
        recoveryRatePercent,
        monthlyTrend,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
