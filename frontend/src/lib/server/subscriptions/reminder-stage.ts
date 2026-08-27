// Renewal-reminder stage predicate — pure function, no I/O. Decides whether
// the subscription-renewal-reminders cron owes this subscription an email
// on this tick, and if so which one ("3d" before renewsAt, "1d" before, or
// "expired" once renewsAt has passed). Mobile Money has no auto-debit, so
// renewal is always a manual re-checkout — these emails are the only nudge
// a user gets before silently dropping back to the free tier.
import { DAY_MS } from '@/lib/server/jurali/balance';

export const REMINDER_WINDOW_3D_MS = 3 * DAY_MS;
export const REMINDER_WINDOW_1D_MS = 1 * DAY_MS;

export type ReminderStage = '3d' | '1d' | 'expired';

export interface ReminderCandidate {
  renewsAt: Date;
  reminderStage: string | null;
  reminderStageRenewsAt: Date | null;
}

/**
 * Returns the stage to send now, or null if nothing is due. `reminderStage`
 * only counts if `reminderStageRenewsAt` matches the current `renewsAt` —
 * a renewal moves `renewsAt` forward, which makes any prior stage stale
 * (a new cycle owes its own "3d"/"1d" reminders) without needing an
 * explicit reset at the renewal call site.
 */
export function nextReminderStage(
  sub: ReminderCandidate,
  now: Date = new Date(),
): ReminderStage | null {
  const currentStage =
    sub.reminderStageRenewsAt && sub.reminderStageRenewsAt.getTime() === sub.renewsAt.getTime()
      ? sub.reminderStage
      : null;

  const msLeft = sub.renewsAt.getTime() - now.getTime();

  if (msLeft <= 0) return currentStage === 'expired' ? null : 'expired';
  if (msLeft <= REMINDER_WINDOW_1D_MS) return currentStage === '1d' ? null : '1d';
  if (msLeft <= REMINDER_WINDOW_3D_MS) return currentStage === null ? '3d' : null;
  return null;
}
