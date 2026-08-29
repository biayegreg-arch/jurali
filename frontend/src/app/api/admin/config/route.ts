// GET/PATCH /api/admin/config — admin-editable platform settings.
//
// Today the only setting is the Premium monthly price. GET is ADMIN-readable
// (any admin can see the current price); PATCH is SUPERADMIN-only, same bar
// as /api/admin/users/[id]/role, since a price change is a financial
// mutation affecting every future checkout. Bounds-checked (100–100 000
// FCFA) as a fat-finger guard, and always audited via logAdminAction.
//
// Existing ACTIVE subscribers are never affected retroactively:
// `Subscription.planAmountFcfa` is snapshotted per-checkout (see
// lib/server/subscriptions/guards.ts) and only re-read from this config on
// the next voluntary re-checkout (Mobile Money has no auto-debit renewal).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin, requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import {
  getPremiumMonthlyPriceFcfa,
  PREMIUM_MONTHLY_PRICE_FCFA,
} from '@/lib/server/subscriptions/guards';

const MIN_PRICE_FCFA = 100;
const MAX_PRICE_FCFA = 100_000;

const Body = z.object({
  premiumMonthlyPriceFcfa: z.number().int().min(MIN_PRICE_FCFA).max(MAX_PRICE_FCFA),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const config = await prisma.platformConfig.findUnique({ where: { id: 'singleton' } });
    return NextResponse.json(
      {
        premiumMonthlyPriceFcfa: config?.premiumMonthlyPriceFcfa ?? PREMIUM_MONTHLY_PRICE_FCFA,
        updatedAt: config?.updatedAt ?? null,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const { premiumMonthlyPriceFcfa } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const from = await getPremiumMonthlyPriceFcfa(tx);

      const config = await tx.platformConfig.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', premiumMonthlyPriceFcfa },
        update: { premiumMonthlyPriceFcfa },
      });

      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'platform_config.price_change',
        targetType: 'PlatformConfig',
        targetId: 'singleton',
        metadata: { from, to: premiumMonthlyPriceFcfa },
      });

      return config;
    });

    return NextResponse.json(
      { premiumMonthlyPriceFcfa: updated.premiumMonthlyPriceFcfa, updatedAt: updated.updatedAt },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
