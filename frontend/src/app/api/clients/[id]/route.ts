// GET /api/clients/[id] — fiche client (PRD 3.6): balance + full
// chronological transaction history, most recent first (US-04).
//
// 404 CLIENT_NOT_FOUND both when the row doesn't exist AND when it belongs
// to a different owner — never distinguish the two on the wire, same
// existence-leak principle CLAUDE.md documents for org membership.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance, isOverdue as computeIsOverdue } from '@/lib/server/jurali/balance';

export async function GET(
  req: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await routeCtx.params;
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        firstName: true,
        phone: true,
        createdAt: true,
        transactions: {
          select: { id: true, type: true, amountFcfa: true, note: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!client || client.ownerId !== auth.user.sub) {
      return NextResponse.json(
        { error: 'CLIENT_NOT_FOUND', message: 'Client not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // Prisma's `type` column is a plain String (see schema.prisma comment);
    // cast once since every row was written through POST /api/transactions'
    // `z.enum(['DEBT', 'PAYMENT'])` contract.
    const chronological = [...client.transactions]
      .reverse()
      .map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' }));
    const balanceFcfa = computeClientBalance(chronological);
    const overdue = computeIsOverdue(chronological);

    return NextResponse.json(
      {
        id: client.id,
        firstName: client.firstName,
        phone: client.phone,
        createdAt: client.createdAt,
        balanceFcfa,
        isOverdue: overdue,
        transactions: client.transactions,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
