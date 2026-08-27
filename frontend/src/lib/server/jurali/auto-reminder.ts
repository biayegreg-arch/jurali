// Auto-reminder detection — Phase 9. Pure predicate: does this client's
// oldest unpaid debt warrant an in-app "you should send a reminder"
// notification? Actually SENDING is still a manual `wa.me` tap (Phase 8) —
// this only decides whether to surface it. Callers (the cron route) are
// responsible for the Premium + `autoReminderEnabled` gates, which are
// per-user, not per-client.
import { DAY_MS } from '@/lib/server/jurali/balance';

export const AUTO_REMINDER_THRESHOLD_DAYS = 7;

export interface AutoReminderCandidate {
  phone: string | null;
  balanceFcfa: number;
  oldestUnpaidDebtDate: Date | null;
  lastReminderSentAt: Date | null;
}

export function isDueForAutoReminder(
  candidate: AutoReminderCandidate,
  now: Date = new Date(),
): boolean {
  if (!candidate.phone) return false;
  if (candidate.balanceFcfa <= 0) return false;
  if (!candidate.oldestUnpaidDebtDate) return false;

  const thresholdMs = AUTO_REMINDER_THRESHOLD_DAYS * DAY_MS;
  const ageMs = now.getTime() - candidate.oldestUnpaidDebtDate.getTime();
  if (ageMs < thresholdMs) return false;

  // A reminder already sent since this debt started aging covers it —
  // don't re-surface until either it's paid (new oldest debt) or enough
  // time passes that the dedupeKey (built from oldestUnpaidDebtDate)
  // would change anyway.
  if (
    candidate.lastReminderSentAt &&
    candidate.lastReminderSentAt.getTime() >= candidate.oldestUnpaidDebtDate.getTime()
  ) {
    return false;
  }

  return true;
}
