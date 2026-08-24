// GET /api/dashboard — the 4 PRD 3.2/US-02 KPIs: total à récupérer, nombre
// de clients débiteurs, montant des dettes anciennes (>30j), total récupéré
// ce mois-ci. Also returns overdueDebtorCount (not one of the PRD's 4
// numbers, but matches Banani's "3 urgents" sub-label under the "En retard"
// tile — cheap to compute alongside overdueDueFcfa).
//
// Reuses Phase 2's listClientSummaries (same balance/aging computation as
// GET /api/clients) so the two endpoints can't disagree about who owes what.
//
// Phase 9 — optional `?month=YYYY-MM` adds `selectedMonth*` fields for the
// month-picker (Banani's `MonthPickerView`, a UI affordance not in the
// PRD). Purely additive: `recoveredThisMonthFcfa` keeps its original
// always-current-month, unbounded-query shape so existing callers/tests
// are untouched.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { listClientSummaries } from '@/lib/server/jurali/clients';
import { parseMonthParam, monthBounds, formatMonthParam } from '@/lib/server/jurali/month-range';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

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

    // Calendar-month boundary in server local time (Vercel runs UTC). A
    // shopkeeper mid-month doesn't care about timezone edge cases at
    // midnight — this is a display aggregate, not a financial ledger cutoff.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const recovered = await prisma.transaction.aggregate({
      where: { ownerId: auth.user.sub, type: 'PAYMENT', createdAt: { gte: startOfMonth } },
      _sum: { amountFcfa: true },
    });

    const { year, month } = parseMonthParam(req.nextUrl.searchParams.get('month'), now);
    const { start: monthStart, end: monthEnd } = monthBounds(year, month);
    const [monthRecovered, monthNewDebts, monthTransactionCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          ownerId: auth.user.sub,
          type: 'PAYMENT',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amountFcfa: true },
      }),
      prisma.transaction.aggregate({
        where: {
          ownerId: auth.user.sub,
          type: 'DEBT',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amountFcfa: true },
      }),
      prisma.transaction.count({
        where: { ownerId: auth.user.sub, createdAt: { gte: monthStart, lt: monthEnd } },
      }),
    ]);

    return NextResponse.json(
      {
        totalDueFcfa,
        debtorCount,
        overdueDueFcfa,
        overdueDebtorCount,
        recoveredThisMonthFcfa: recovered._sum.amountFcfa ?? 0,
        selectedMonth: formatMonthParam(year, month),
        selectedMonthRecoveredFcfa: monthRecovered._sum.amountFcfa ?? 0,
        selectedMonthNewDebtsFcfa: monthNewDebts._sum.amountFcfa ?? 0,
        selectedMonthTransactionCount: monthTransactionCount,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
