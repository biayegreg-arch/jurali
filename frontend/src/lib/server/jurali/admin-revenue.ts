// Real Premium-payment history for the admin console (/admin dashboard's
// "Paiements récents" + /admin/revenue), built from data that already
// exists — WebhookLog (every Bictorys webhook delivery, kept for
// idempotency) — instead of inventing figures the way Banani's mockup does
// (its "2023 vs 2024" comparison has no backing data in this app).
//
// KNOWN LIMITATION: `Subscription` is ONE row reused across renewals (see
// subscriptions/guards.ts) — `providerChargeId` is overwritten on every new
// checkout. Correlating a WebhookLog row to a Subscription via
// `providerChargeId` therefore only works for that subscriber's MOST
// RECENT checkout attempt; once they renew, their earlier payment's
// WebhookLog row becomes uncorrelated (the Subscription's providerChargeId
// has moved on) and silently drops out of this history. Acceptable for a
// "recent activity" widget on a young product with few renewals yet; would
// need a dedicated payment-ledger table to stay accurate long-term.
import 'server-only';
import type { PrismaClient } from '@prisma/client';

const SCAN_LIMIT = 200; // over-fetch: not every webhook (e.g. Order charges) correlates to a Subscription

function classifyPayloadStatus(payload: unknown): 'PAID' | 'FAILED' | null {
  const status = String(
    (payload as Record<string, unknown> | null)?.['status'] ?? '',
  ).toLowerCase();
  if (['succeeded', 'paid', 'success', 'completed'].includes(status)) return 'PAID';
  if (
    ['failed', 'cancelled', 'canceled', 'rejected', 'error', 'refunded', 'refund'].includes(status)
  ) {
    return 'FAILED';
  }
  return null; // pending / unknown — not a terminal payment event
}

function extractChargeId(payload: unknown): string {
  const p = payload as Record<string, unknown> | null;
  return String(p?.['charge_id'] ?? p?.['chargeId'] ?? p?.['id'] ?? '');
}

export interface SubscriptionPaymentEvent {
  id: string;
  createdAt: Date;
  status: 'PAID' | 'FAILED';
  amountFcfa: number;
  ownerEmail: string;
  ownerShopName: string | null;
}

/**
 * Scans the most recent Bictorys webhook deliveries and returns the ones
 * that correlate to a Subscription charge, newest first, capped at `limit`.
 */
export async function getRecentSubscriptionPayments(
  prisma: PrismaClient,
  limit = 10,
): Promise<SubscriptionPaymentEvent[]> {
  const logs = await prisma.webhookLog.findMany({
    where: { provider: 'bictorys' },
    orderBy: { createdAt: 'desc' },
    take: SCAN_LIMIT,
    select: { id: true, createdAt: true, payload: true },
  });

  const events: SubscriptionPaymentEvent[] = [];
  for (const log of logs) {
    if (events.length >= limit) break;
    const status = classifyPayloadStatus(log.payload);
    if (!status) continue;
    const externalId = extractChargeId(log.payload);
    if (!externalId) continue;

    const sub = await prisma.subscription.findFirst({
      where: { providerChargeId: externalId },
      select: { planAmountFcfa: true, owner: { select: { email: true, shopName: true } } },
    });
    if (!sub) continue; // an Order charge, or a renewal whose row has since moved on

    events.push({
      id: log.id,
      createdAt: log.createdAt,
      status,
      amountFcfa: sub.planAmountFcfa,
      ownerEmail: sub.owner.email,
      ownerShopName: sub.owner.shopName,
    });
  }
  return events;
}

export interface MonthlyRevenuePoint {
  month: string; // "2026-08"
  totalFcfa: number;
}

/**
 * Pure — sums PAID events (see limitation above) into monthly buckets
 * covering the last `months` calendar months, oldest first, zero-filled for
 * months with no activity. Callers that need both the bucketed chart AND
 * the raw recent-events list should fetch events ONCE via
 * `getRecentSubscriptionPayments(prisma, SCAN_LIMIT)` and pass them to both
 * this function and their own slicing — do not call the async fetch twice.
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
