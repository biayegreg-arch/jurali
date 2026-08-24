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
import { isSubscriptionActive } from '@/lib/server/subscriptions/guards';

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

    const subscription = await prisma.subscription.findUnique({
      where: { ownerId: auth.user.sub },
    });
    if (!isSubscriptionActive(subscription)) {
      return NextResponse.json(
        {
          error: 'PREMIUM_REQUIRED',
          message: 'WhatsApp reminders require an active Premium subscription.',
        },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const { id } = await routeCtx.params;
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        firstName: true,
        phone: true,
        transactions: { select: { type: true, amountFcfa: true } },
      },
    });

    if (!client || client.ownerId !== auth.user.sub) {
      return NextResponse.json(
        { error: 'CLIENT_NOT_FOUND', message: 'Client not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

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
