// POST /api/clients/[id]/remind — Jurali Phase 8, US-07 manual WhatsApp
// reminder (thin PRD version — no bulk selection, no SMS channel, no
// response tracking; see Phase 9 backlog in the roadmap for those).
//
// Premium-gated: 403 PREMIUM_REQUIRED for a free-tier user (matches
// US-07's "en version gratuite, le bouton est visible mais grisé avec
// mention Premium"). 409 CLIENT_NO_PHONE / NOTHING_OWED mirror US-07's
// other button-visibility precondition (a registered phone + solde > 0).
// The wa.me link pre-fills the message but does not send it — the
// boutiquier still taps send inside WhatsApp, satisfying "peut visualiser
// le message avant envoi" with no extra preview UI needed.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance } from '@/lib/server/jurali/balance';
import { buildReminderMessage, buildWhatsAppReminderUrl } from '@/lib/server/jurali/reminder';
import { requirePremium } from '@/lib/server/subscriptions/guards';
import { requireOwnedClient } from '@/lib/server/jurali/clients';

export async function POST(
  req: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const premiumFail = await requirePremium(
      prisma,
      auth.user.sub,
      ctx.requestId,
      'WhatsApp reminders require an active Premium subscription.',
    );
    if (premiumFail) return premiumFail;

    const { id } = await routeCtx.params;
    const found = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        firstName: true,
        phone: true,
        transactions: { select: { type: true, amountFcfa: true } },
      },
    });
    const client = requireOwnedClient(found, auth.user.sub, ctx.requestId);
    if (client instanceof NextResponse) return client;

    if (!client.phone) {
      return NextResponse.json(
        { error: 'CLIENT_NO_PHONE', message: 'This client has no registered phone number.' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const balanceFcfa = computeClientBalance(
      client.transactions.map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' })),
    );
    if (balanceFcfa <= 0) {
      return NextResponse.json(
        { error: 'NOTHING_OWED', message: 'This client has no outstanding balance.' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const owner = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { shopName: true },
    });

    const message = buildReminderMessage({
      firstName: client.firstName,
      balanceFcfa,
      shopName: owner?.shopName ?? null,
    });
    const url = buildWhatsAppReminderUrl(client.phone, message);

    const updated = await prisma.client.update({
      where: { id: client.id },
      data: { lastReminderSentAt: new Date() },
      select: { lastReminderSentAt: true },
    });

    return NextResponse.json(
      { url, lastReminderSentAt: updated.lastReminderSentAt },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
