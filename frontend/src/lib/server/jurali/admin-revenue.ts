// Real Premium-payment history for the admin console (/admin dashboard's
// "Paiements récents" + /admin/revenue), backed by the SubscriptionPayment
// ledger (see prisma/schema.prisma doc comment) — a permanent row per
// webhook-confirmed event, written inside the webhook's own Serializable
// tx (api/webhooks/bictorys/route.ts onPaid/onFailed/onRefunded).
//
// Previously this scanned WebhookLog and correlated rows to a Subscription
// via providerChargeId — since that column is overwritten on every renewal
// (Subscription is one row reused across billing cycles, see
// subscriptions/guards.ts), a subscriber's earlier payments silently
// dropped out of the history once they renewed. The ledger table fixes
// this by recording every event permanently, independent of what the
// Subscription row currently points at. Rows written before this ledger
// existed are not backfilled — history starts from the migration date.
import 'server-only';
import type { PrismaClient } from '@prisma/client';

const SCAN_LIMIT = 200;

export interface SubscriptionPaymentEvent {
  id: string;
  createdAt: Date;
  status: 'PAID' | 'FAILED';
  amountFcfa: number;
  ownerEmail: string;
  ownerShopName: string | null;
}

/**
 * Most recent Premium payment events, newest first, capped at `limit`.
 */
export async function getRecentSubscriptionPayments(
  prisma: PrismaClient,
  limit = 10,
): Promise<SubscriptionPaymentEvent[]> {
  const rows = await prisma.subscriptionPayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      status: true,
      amountFcfa: true,
      owner: { select: { email: true, shopName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    status: r.status as 'PAID' | 'FAILED',
    amountFcfa: r.amountFcfa,
    ownerEmail: r.owner.email,
    ownerShopName: r.owner.shopName,
  }));
}

export interface MonthlyRevenuePoint {
  month: string; // "2026-08"
  totalFcfa: number;
}

/**
 * Pure — sums PAID events into monthly buckets covering the last `months`
 * calendar months, oldest first, zero-filled for months with no activity.
 * Callers that need both the bucketed chart AND the raw recent-events list
 * should fetch events ONCE via `getRecentSubscriptionPayments(prisma,
 * SCAN_LIMIT)` and pass them to both this function and their own slicing —
 * do not call the async fetch twice.
 */
export function bucketMonthlyRevenue(
  events: readonly SubscriptionPaymentEvent[],
  months = 6,
): MonthlyRevenuePoint[] {
  const now = new Date();
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, 0);
  }

  for (const e of events) {
    if (e.status !== 'PAID') continue;
    const key = `${e.createdAt.getUTCFullYear()}-${String(e.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + e.amountFcfa);
  }

  return [...buckets.entries()].map(([month, totalFcfa]) => ({ month, totalFcfa }));
}

/** Convenience one-shot wrapper for callers that only need the chart. */
export async function getMonthlyRevenue(
  prisma: PrismaClient,
  months = 6,
): Promise<MonthlyRevenuePoint[]> {
  const events = await getRecentSubscriptionPayments(prisma, SCAN_LIMIT);
  return bucketMonthlyRevenue(events, months);
}

export { SCAN_LIMIT };
