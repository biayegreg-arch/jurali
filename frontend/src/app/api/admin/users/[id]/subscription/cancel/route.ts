// POST /api/admin/users/[id]/subscription/cancel — admin-forced Premium
// cancellation. Same immediate-revocation semantics as the self-service
// DELETE /api/subscriptions (status -> CANCELED, forfeits remaining paid
// days — Mobile Money has no auto-debit to "stop" otherwise), just
// initiated by an admin instead of the owner. SUPERADMIN-only: this
// removes value from a paying customer, same bar as a withdrawal cancel or
// a price change.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

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
    const existing = await prisma.subscription.findUnique({ where: { ownerId: id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_NOT_FOUND', message: 'This user has no subscription.' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }
    if (existing.status === 'CANCELED') {
      return NextResponse.json(
        { subscription: { id: existing.id, status: existing.status } },
        { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    // Re-check status inside the transaction (not just the pre-tx `existing`
    // read above): two concurrent cancel calls can both pass the check
    // above before either commits, and without this re-check both would
    // write an `AdminAction` claiming `from: 'ACTIVE'`, even though the
    // second one's real transition is CANCELED -> CANCELED — an inaccurate
    // audit trail, not a double-spend (the field write itself is
    // idempotent).
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.subscription.findUnique({ where: { ownerId: id } });
      if (!current || current.status === 'CANCELED') return current;

      const sub = await tx.subscription.update({
        where: { ownerId: id },
        data: { status: 'CANCELED' },
      });
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'subscription.admin_cancel',
        targetType: 'Subscription',
        targetId: sub.id,
        metadata: { ownerId: id, from: current.status, to: 'CANCELED' },
      });
      return sub;
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'SUBSCRIPTION_NOT_FOUND', message: 'This user has no subscription.' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    return NextResponse.json(
      { subscription: { id: updated.id, status: updated.status } },
      { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
