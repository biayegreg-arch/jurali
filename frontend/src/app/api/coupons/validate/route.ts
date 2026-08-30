// POST /api/coupons/validate — live discount preview for /premium/checkout.
//
// Authenticated, but never mutates anything and never increments
// Coupon.redemptionCount — that only happens once the webhook confirms an
// actual payment (see /api/webhooks/bictorys onPaid). This route exists
// purely so the checkout page can show "-20% -> 2 000 FCFA" before the
// user commits to paying; POST /api/subscriptions re-validates the same
// code server-side at charge time regardless of what this endpoint said.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import {
  applyCouponDiscount,
  getPremiumMonthlyPriceFcfa,
  validateCoupon,
} from '@/lib/server/subscriptions/guards';

const Body = z.object({
  code: z.string().trim().min(1).max(32),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const [result, priceFcfa] = await Promise.all([
      validateCoupon(prisma, parsed.data.code),
      getPremiumMonthlyPriceFcfa(prisma),
    ]);

    if (!result.ok || !result.coupon) {
      return NextResponse.json(
        { error: result.errorCode ?? 'COUPON_NOT_FOUND', message: 'Invalid or expired code.' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const discountedAmountFcfa = applyCouponDiscount(priceFcfa, result.coupon.percentOff);

    return NextResponse.json(
      {
        code: result.coupon.code,
        percentOff: result.coupon.percentOff,
        priceFcfa,
        discountedAmountFcfa,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
