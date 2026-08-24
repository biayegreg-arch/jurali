export const PREMIUM_MONTHLY_PRICE_FCFA = 2500;
export const SUBSCRIPTION_PERIOD_DAYS = 30;

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
