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
