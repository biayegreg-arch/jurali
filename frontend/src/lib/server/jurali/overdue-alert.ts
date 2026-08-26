// Daily "clients overdue 14+ days" digest — Phase 9 (Parametres.jsx's
// "Notifications dettes en retard"). Distinct threshold/cadence from
// auto-reminder.ts's 7-day per-client WhatsApp nudge: this is a once-a-day
// per-USER summary ("N clients have debts overdue by 14+ days"), not a
// per-client action prompt.
export const OVERDUE_ALERT_THRESHOLD_DAYS = 14;

export interface OverdueAlertCandidate {
  oldestUnpaidDebtDate: Date | null;
}

export function countClientsOverdue(
  clients: OverdueAlertCandidate[],
  thresholdDays: number = OVERDUE_ALERT_THRESHOLD_DAYS,
  now: Date = new Date(),
): number {
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return clients.filter((c) => {
    if (!c.oldestUnpaidDebtDate) return false;
    return now.getTime() - c.oldestUnpaidDebtDate.getTime() >= thresholdMs;
  }).length;
}
