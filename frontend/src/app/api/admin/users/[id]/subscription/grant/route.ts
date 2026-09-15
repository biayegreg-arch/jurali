// POST /api/admin/users/[id]/subscription/grant — admin-forced Premium
// activation, the counterpart of subscription/cancel. Upserts a Subscription
// row (a user may never have checked out before) with status ACTIVE and a
// fresh SUBSCRIPTION_PERIOD_DAYS window, `planAmountFcfa: 0` to keep the
// audit trail honest that this period wasn't actually paid for. SUPERADMIN-
// only: same bar as force-cancelling — this is granting real product value
// for free, not a routine support action.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { SUBSCRIPTION_PERIOD_DAYS } from '@/lib/server/subscriptions/guards';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;
    const owner = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!owner) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const renewsAt = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { ownerId: id } });
      const sub = await tx.subscription.upsert({
        where: { ownerId: id },
        create: {
          ownerId: id,
          status: 'ACTIVE',
          planAmountFcfa: 0,
          renewsAt,
        },
        update: {
          status: 'ACTIVE',
          planAmountFcfa: 0,
          renewsAt,
        },
      });
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'subscription.admin_grant',
        targetType: 'Subscription',
        targetId: sub.id,
        metadata: { ownerId: id, from: before?.status ?? 'NONE', to: 'ACTIVE', renewsAt },
      });
      return sub;
    });

    return NextResponse.json(
      { subscription: { id: updated.id, status: updated.status, renewsAt: updated.renewsAt } },
      { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
