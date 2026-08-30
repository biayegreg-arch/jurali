// PATCH /api/admin/coupons/[id] — toggle a coupon active/inactive.
//
// SUPERADMIN-only, mirrors /api/admin/config's PATCH bar. Deliberately the
// ONLY mutation this route allows — percentOff/code are immutable after
// creation (retroactively changing a live discount is confusing for
// customers who already saw the old number; create a new coupon instead).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  active: z.boolean(),
});

export async function PATCH(
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
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.coupon.findUnique({ where: { id } });
      if (!existing) return null;
      if (existing.active === parsed.data.active) return existing; // idempotent no-op, no audit noise

      const updated = await tx.coupon.update({
        where: { id },
        data: { active: parsed.data.active },
      });
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: parsed.data.active ? 'coupon.activate' : 'coupon.deactivate',
        targetType: 'Coupon',
        targetId: id,
        metadata: { code: existing.code },
      });
      return updated;
    });

    if (!result) {
      return NextResponse.json(
        { error: 'COUPON_NOT_FOUND', message: 'Coupon not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    return NextResponse.json(
      { coupon: { id: result.id, code: result.code, active: result.active } },
      { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
