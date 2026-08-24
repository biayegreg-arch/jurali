/**
 * Notification templates.
 *
 * Each project defines its own typed wrappers around `createNotification`.
 * The example below ships with the template — adapt it, replace it, or add
 * more (e.g. `firePaymentReceived`, `fireExportReady`). The pattern:
 *
 *   1. Build a `CreateNotificationInput` with a *deterministic* dedupeKey
 *      so the unique constraint enforces at-most-once delivery for that
 *      logical event (e.g. `payment-received:${orderId}` — never include
 *      a timestamp or random suffix).
 *   2. Pass the input + your PrismaClient to `createNotification`.
 *   3. Optionally enqueue an email via `EmailQueue.enqueue` — but ONLY
 *      after the notification row is created, so a duplicate event never
 *      sends a duplicate email.
 *
 * Keep these helpers free of side effects beyond the row insert; the
 * email enqueue belongs at the call site so each project can pick the
 * right channel (no email vs. transactional vs. marketing).
 */

import type { CreateNotificationInput } from './index';

export function welcomeNotification(userId: string, email: string): CreateNotificationInput {
  return {
    userId,
    type: 'WELCOME',
    title: 'Welcome!',
    body: `Glad to have you on board, ${email}.`,
    dedupeKey: `welcome:${userId}`,
  };
}

/**
 * Example: notification dispatched after a successful payment.
 * Called from the Bictorys webhook handler's `onPaid` post-commit hook.
 */
export function paymentReceived(
  userId: string,
  orderId: string,
  amount: number,
  currency: string,
): CreateNotificationInput {
  return {
    userId,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment received',
    body: `Order ${orderId} for ${amount} ${currency} confirmed.`,
    data: { orderId, amount, currency },
    dedupeKey: `payment-received:${orderId}`,
  };
}

/**
 * Jurali Phase 9 — auto-reminder cron detected a client 7+ days overdue
 * with no reminder sent since. `dedupeKey` is keyed off the debt's own
 * aging date (not a timestamp) so it fires once per "new oldest overdue
 * debt", not once per cron tick — see `lib/server/jurali/auto-reminder.ts`.
 * The notification is informational only; sending the WhatsApp message is
 * still a manual `wa.me` tap (Phase 8) — `data.clientId` deep-links there.
 */
export function autoReminderDue(
  userId: string,
  clientId: string,
  clientFirstName: string,
  oldestUnpaidDebtDate: Date,
): CreateNotificationInput {
  return {
    userId,
    type: 'AUTO_REMINDER_DUE',
    title: 'Rappel à envoyer',
    body: `${clientFirstName} a une dette de plus de 7 jours sans rappel. Envoie-lui un message WhatsApp.`,
    data: { clientId },
    dedupeKey: `auto-reminder:${clientId}:${oldestUnpaidDebtDate.toISOString().slice(0, 10)}`,
  };
}
