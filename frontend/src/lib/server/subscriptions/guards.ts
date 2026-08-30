import 'server-only';
import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';

// Fallback used until an admin sets a price (or the PlatformConfig row is
// somehow missing) — see `getPremiumMonthlyPriceFcfa` below, the real
// source of truth once /admin/subscriptions has been used.
export const PREMIUM_MONTHLY_PRICE_FCFA = 2500;
export const SUBSCRIPTION_PERIOD_DAYS = 30;

/**
 * Admin-editable Premium price (Jurali admin console, /admin/subscriptions).
 * Reads the `PlatformConfig` singleton; falls back to the hardcoded default
 * when no admin has ever set a price (no backfill migration needed).
 */
export async function getPremiumMonthlyPriceFcfa(
  prisma: Pick<PrismaClient, 'platformConfig'>,
): Promise<number> {
  const config = await prisma.platformConfig.findUnique({ where: { id: 'singleton' } });
  return config?.premiumMonthlyPriceFcfa ?? PREMIUM_MONTHLY_PRICE_FCFA;
}

export interface SubscriptionState {
  status: string;
  renewsAt: Date | null;
}

/**
 * "Active" is always computed from `renewsAt`, never trusted from
 * `status` alone — a webhook-set `ACTIVE` naturally lapses once the period
 * ends, with no expiration cron required to keep the free-tier gate
 * (POST /api/clients) correct.
 */
export function isSubscriptionActive(
  subscription: SubscriptionState | null,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'ACTIVE') return false;
  if (!subscription.renewsAt) return false;
  return subscription.renewsAt.getTime() > now.getTime();
}

/**
 * Fetch-subscription-then-gate, copy-pasted identically across every
 * Premium-only route (export, remind, stats). Returns `null` when the
 * caller may proceed, or the 403 PREMIUM_REQUIRED response to return
 * as-is — matches the `requireAuth`/`requireOrgRole` HOF idiom used
 * elsewhere: `const fail = await requirePremium(...); if (fail) return
 * fail;`. `message` stays per-route so each 403 keeps its specific wording.
 */
export async function requirePremium(
  prisma: Pick<PrismaClient, 'subscription'>,
  ownerId: string,
  requestId: string,
  message: string,
): Promise<NextResponse | null> {
  const subscription = await prisma.subscription.findUnique({ where: { ownerId } });
  if (isSubscriptionActive(subscription)) return null;
  return NextResponse.json(
    { error: 'PREMIUM_REQUIRED', message },
    { status: 403, headers: { 'x-request-id': requestId } },
  );
}

export interface CouponValidationResult {
  ok: boolean;
  errorCode: 'COUPON_NOT_FOUND' | 'COUPON_INACTIVE' | 'COUPON_EXPIRED' | null;
  coupon?: { id: string; code: string; percentOff: number };
}

/**
 * Shared by POST /api/coupons/validate (live preview on the checkout page)
 * and POST /api/subscriptions (the real charge) — the checkout page's
 * client-computed discount is only a preview; this is re-run server-side
 * at charge time so a stale/expired/deactivated code can never actually
 * discount a real payment.
 */
export async function validateCoupon(
  prisma: Pick<PrismaClient, 'coupon'>,
  rawCode: string,
  now: Date = new Date(),
): Promise<CouponValidationResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, errorCode: 'COUPON_NOT_FOUND' };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false, errorCode: 'COUPON_NOT_FOUND' };
  if (!coupon.active) return { ok: false, errorCode: 'COUPON_INACTIVE' };
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, errorCode: 'COUPON_EXPIRED' };
  }

  return {
    ok: true,
    errorCode: null,
    coupon: { id: coupon.id, code: coupon.code, percentOff: coupon.percentOff },
  };
}

/** Integer FCFA in, integer FCFA out — never introduce decimals. */
export function applyCouponDiscount(priceFcfa: number, percentOff: number): number {
  return Math.round((priceFcfa * (100 - percentOff)) / 100);
}
