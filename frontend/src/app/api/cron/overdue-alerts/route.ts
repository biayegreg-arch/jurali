// POST /api/cron/overdue-alerts — Jurali Phase 9. Daily digest: scans
// Premium accounts with `User.overdueAlertsEnabled` on for how many of
// their clients have a debt overdue 14+ days, and creates ONE in-app
// Notification per qualifying user (not per client — see
// `lib/server/jurali/overdue-alert.ts` and `notifications/templates.ts`'s
// `overdueAlertDue`). Distinct from `cron/auto-reminders` (7-day,
// per-client, hourly) — this is a once-a-day summary.
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
import { oldestUnpaidDebtDate } from '@/lib/server/jurali/balance';
import { countClientsOverdue } from '@/lib/server/jurali/overdue-alert';
import { isSubscriptionActive } from '@/lib/server/subscriptions/guards';
import { createNotification } from '@/lib/server/notifications';
import { overdueAlertDue } from '@/lib/server/notifications/templates';

const log = createLogger();
const LEASE_TTL_MS = 60_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let usersScanned = 0;
    let usersNotified = 0;

    await withLease(redis ?? undefined, 'overdue-alerts', LEASE_TTL_MS, async () => {
      const now = new Date();
      const users = await prisma.user.findMany({
        where: { overdueAlertsEnabled: true },
        select: {
          id: true,
          subscription: { select: { status: true, renewsAt: true } },
          clients: {
            select: {
              id: true,
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
        const candidates = user.clients.map((client) => ({
          oldestUnpaidDebtDate: oldestUnpaidDebtDate(
            client.transactions.map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' })),
          ),
        }));
        const overdueCount = countClientsOverdue(candidates, undefined, now);
        if (overdueCount === 0) continue;

        notifications.push(createNotification(prisma, overdueAlertDue(user.id, overdueCount, now)));
        usersNotified += 1;
      }
      // Each insert is independent (own dedupeKey, no shared transaction) —
      // no reason to await them one at a time inside the scan loop.
      await Promise.all(notifications);

      log.info('overdue-alerts tick', { usersScanned, usersNotified, requestId: ctx.requestId });
    });

    return NextResponse.json(
      { ok: true, usersScanned, usersNotified },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
