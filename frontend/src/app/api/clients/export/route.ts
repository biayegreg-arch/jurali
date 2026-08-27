// GET /api/clients/export — "Exporter toutes les dettes" (Parametres.jsx's
// "Données" section). Premium-gated like /api/stats and
// /api/clients/[id]/remind. Returns every transaction across every client
// the owner has, flattened into CSV-ready rows — the client builds the
// actual CSV blob (no server-side file generation, matches
// jurali-pdf.ts's client-side-only precedent for the per-client PDF).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { requirePremium } from '@/lib/server/subscriptions/guards';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const premiumFail = await requirePremium(
      prisma,
      auth.user.sub,
      ctx.requestId,
      'Exporting all debts requires an active Premium subscription.',
    );
    if (premiumFail) return premiumFail;

    const clients = await prisma.client.findMany({
      where: { ownerId: auth.user.sub },
      select: {
        firstName: true,
        phone: true,
        transactions: {
          select: { type: true, amountFcfa: true, note: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const items = clients.flatMap((client) =>
      client.transactions.map((t) => ({
        clientName: client.firstName,
        phone: client.phone,
        type: t.type,
        amountFcfa: t.amountFcfa,
        note: t.note,
        createdAt: t.createdAt,
      })),
    );

    return NextResponse.json({ items }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
