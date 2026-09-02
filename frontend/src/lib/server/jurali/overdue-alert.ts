// Daily "clients overdue 14+ days" digest — Phase 9 (Parametres.jsx's
// "Notifications dettes en retard"). Distinct threshold/cadence from
// auto-reminder.ts's 7-day per-client WhatsApp nudge: this is a once-a-day
// per-USER summary ("N clients have debts overdue by 14+ days"), not a
// per-client action prompt.
import { DAY_MS } from '@/lib/server/jurali/balance';

export const OVERDUE_ALERT_THRESHOLD_DAYS = 14;

export interface OverdueAlertCandidate {
  oldestUnpaidDebtDate: Date | null;
  /** Per-client override; falls back to OVERDUE_ALERT_THRESHOLD_DAYS. */
  thresholdDays?: number;
}

export function countClientsOverdue(
  clients: OverdueAlertCandidate[],
  now: Date = new Date(),
): number {
  return clients.filter((c) => {
    if (!c.oldestUnpaidDebtDate) return false;
    const thresholdMs = (c.thresholdDays ?? OVERDUE_ALERT_THRESHOLD_DAYS) * DAY_MS;
    return now.getTime() - c.oldestUnpaidDebtDate.getTime() >= thresholdMs;
  }).length;
}
