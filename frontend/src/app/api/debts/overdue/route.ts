// GET /api/debts/overdue — Banani's "Dettes en retard" desktop screen. One
// row PER OVERDUE DEBT (not per client) across every client the owner has —
// a client with several individually-overdue debts (FIFO queue can hold
// more than one past the threshold) appears once per debt. Free-tier
// accessible like /api/clients: the underlying data (which debts are
// overdue) is core functionality, not a Premium differentiator — only the
// per-row WhatsApp reminder (POST /api/clients/[id]/remind) and the CSV
// export (GET /api/clients/export) stay Premium-gated at their own routes,
// unlike /api/stats which is gated as a whole page.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { listOverdueDebts } from '@/lib/server/jurali/balance';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const clients = await prisma.client.findMany({
      where: { ownerId: auth.user.sub },
      select: {
        id: true,
        firstName: true,
        phone: true,
        transactions: {
          select: { id: true, type: true, amountFcfa: true, note: true, createdAt: true },
        },
      },
    });

    const now = new Date();
    const items = clients
      .flatMap((client) =>
        listOverdueDebts(
          client.transactions.map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' })),
          now,
        ).map((row) => ({
          id: row.id,
          clientId: client.id,
          clientName: client.firstName,
          clientPhone: client.phone,
          amountFcfa: row.amountFcfa,
          note: row.note,
          createdAt: row.createdAt,
          daysOverdue: Math.floor((now.getTime() - row.createdAt.getTime()) / DAY_MS),
        })),
      )
      // Most urgent (longest overdue) first — more useful for deciding who
      // to chase first than Banani's own mock order (by debt date, which
      // happened to also be ascending days-overdue only by coincidence of
      // its 3 illustrative rows).
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const totalOverdueFcfa = items.reduce((sum, i) => sum + i.amountFcfa, 0);
    const averageDaysOverdue =
      items.length > 0
        ? Math.round(items.reduce((sum, i) => sum + i.daysOverdue, 0) / items.length)
        : 0;
    const affectedClientCount = new Set(items.map((i) => i.clientId)).size;

    return NextResponse.json(
      {
        totalOverdueFcfa,
        averageDaysOverdue,
        affectedClientCount,
        totalClientCount: clients.length,
        items,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
