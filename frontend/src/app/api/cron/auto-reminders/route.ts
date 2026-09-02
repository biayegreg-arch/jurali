// POST /api/cron/auto-reminders — Jurali Phase 9. Scans Premium accounts
// with `User.autoReminderEnabled` on for clients whose oldest unpaid debt
// has aged 7+ days with no reminder sent since, and creates an in-app
// Notification for each (Phase 8's manual `wa.me` button still does the
// actual sending — see `lib/server/jurali/auto-reminder.ts` for why a
// truly silent auto-send isn't possible without the WhatsApp Business API).
//
// Only scans users who are BOTH opted in AND currently Premium — mirrors
// Phase 8's `POST /api/clients/[id]/remind` gate, since surfacing "send a
// reminder" to a free-tier user whose button is grayed out is pointless.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance, oldestUnpaidDebtDate } from '@/lib/server/jurali/balance';
import {
  isDueForAutoReminder,
  AUTO_REMINDER_THRESHOLD_DAYS,
} from '@/lib/server/jurali/auto-reminder';
import { isSubscriptionActive } from '@/lib/server/subscriptions/guards';
import { createNotification } from '@/lib/server/notifications';
import { autoReminderDue } from '@/lib/server/notifications/templates';

const log = createLogger();
const LEASE_TTL_MS = 60_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let usersScanned = 0;
    let clientsScanned = 0;
    let notified = 0;

    await withLease(redis ?? undefined, 'auto-reminders', LEASE_TTL_MS, async () => {
      const now = new Date();
      const users = await prisma.user.findMany({
        where: { autoReminderEnabled: true },
        select: {
          id: true,
          subscription: { select: { status: true, renewsAt: true } },
          clients: {
            select: {
              id: true,
              firstName: true,
              phone: true,
              lastReminderSentAt: true,
              autoReminderEnabled: true,
              autoReminderThresholdDays: true,
              transactions: { select: { type: true, amountFcfa: true, createdAt: true } },
            },
          },
        },
      });
      // "Active" is only ever computed via isSubscriptionActive — never a
      // raw status/renewsAt filter — so this cron can't drift from the
      // free-tier gate's own definition of Premium.
      const activeUsers = users.filter((u) => isSubscriptionActive(u.subscription, now));
      usersScanned = activeUsers.length;

      const notifications: Promise<unknown>[] = [];
      for (const user of activeUsers) {
        for (const client of user.clients) {
          clientsScanned += 1;
          // Only an explicit `false` opts a client out — `undefined` (older
          // rows / test mocks predating this column) defaults to enabled,
          // matching the schema's `@default(true)`.
          if (client.autoReminderEnabled === false) continue;
          const transactions = client.transactions.map((t) => ({
            ...t,
            type: t.type as 'DEBT' | 'PAYMENT',
          }));
          const debtDate = oldestUnpaidDebtDate(transactions);
          const thresholdDays = client.autoReminderThresholdDays ?? AUTO_REMINDER_THRESHOLD_DAYS;
          const due = isDueForAutoReminder(
            {
              phone: client.phone,
              balanceFcfa: computeClientBalance(transactions),
              oldestUnpaidDebtDate: debtDate,
              lastReminderSentAt: client.lastReminderSentAt,
            },
            now,
            thresholdDays,
          );
          if (!due || !debtDate) continue; // debtDate null-check narrows for TS; `due` already guarantees it

          notifications.push(
            createNotification(
              prisma,
              autoReminderDue(user.id, client.id, client.firstName, debtDate, thresholdDays),
            ),
          );
          notified += 1;
        }
      }
      // Each insert is independent (own dedupeKey, no shared transaction) —
      // no reason to await them one at a time inside the scan loop.
      await Promise.all(notifications);

      log.info('auto-reminders tick', {
        usersScanned,
        clientsScanned,
        notified,
        requestId: ctx.requestId,
      });
    });

    return NextResponse.json(
      { ok: true, usersScanned, clientsScanned, notified },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
