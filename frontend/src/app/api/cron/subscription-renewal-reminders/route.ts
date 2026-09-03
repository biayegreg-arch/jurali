// POST /api/cron/subscription-renewal-reminders — Mobile Money has no
// auto-debit, so renewal is always a manual re-checkout on /premium. This
// cron is the only nudge a subscriber gets before silently dropping back
// to the free tier: an email 3 days before `renewsAt`, another 1 day
// before, and one right after it lapses (see
// lib/server/subscriptions/reminder-stage.ts for the stage predicate).
//
// Skips users whose email is a synthetic phone-signup placeholder
// (isSyntheticEmail) — there is no deliverable address to send to; a
// future iteration could add a WhatsApp/SMS channel for those accounts.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { getEmailQueue } from '@/lib/server/queues/email-queue-singleton';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { isSyntheticEmail } from '@/lib/server/auth/synthetic-email';
import { nextReminderStage } from '@/lib/server/subscriptions/reminder-stage';
import {
  subscriptionExpiringEmail,
  subscriptionExpiredEmail,
} from '@/lib/server/subscriptions/email-templates';

const log = createLogger();
const LEASE_TTL_MS = 60_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let scanned = 0;
    let sent = 0;
    let skippedSyntheticEmail = 0;

    await withLease(
      redis ?? undefined,
      'subscription-renewal-reminders',
      LEASE_TTL_MS,
      async () => {
        const queue = getEmailQueue();
        if (!queue) {
          log.warn(
            'subscription-renewal-reminders: not configured (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN/RESEND_API_KEY missing)',
            { requestId: ctx.requestId },
          );
          return;
        }

        const publicUrl = process.env.PUBLIC_URL ?? '';
        const manageUrl = `${publicUrl}/premium`;
        const now = new Date();

        const subscriptions = await prisma.subscription.findMany({
          where: { status: 'ACTIVE', renewsAt: { not: null } },
          select: {
            id: true,
            renewsAt: true,
            reminderStage: true,
            reminderStageRenewsAt: true,
            planAmountFcfa: true,
            owner: { select: { email: true } },
          },
        });
        scanned = subscriptions.length;

        const work: Promise<unknown>[] = [];
        for (const sub of subscriptions) {
          if (!sub.renewsAt) continue; // narrows for TS; query already filters this
          const stage = nextReminderStage(
            {
              renewsAt: sub.renewsAt,
              reminderStage: sub.reminderStage,
              reminderStageRenewsAt: sub.reminderStageRenewsAt,
            },
            now,
          );
          if (!stage) continue;

          if (isSyntheticEmail(sub.owner.email)) {
            skippedSyntheticEmail += 1;
            continue;
          }

          const tpl =
            stage === 'expired'
              ? subscriptionExpiredEmail({ planAmountFcfa: sub.planAmountFcfa, manageUrl })
              : subscriptionExpiringEmail({
                  daysLeft: stage === '3d' ? 3 : 1,
                  planAmountFcfa: sub.planAmountFcfa,
                  manageUrl,
                });

          work.push(
            (async () => {
              try {
                // The EmailJob row and the reminderStage advance must commit
                // together: if the stage update failed after a bare
                // `queue.enqueue()` (Postgres write + Redis push) had
                // already succeeded, the next tick would see the same stage
                // still due and enqueue a SECOND job for the same reminder —
                // a duplicate email to the customer. Creating the EmailJob
                // row in the same transaction as the Subscription update
                // means a failure rolls back BOTH (clean retry next tick,
                // no partial state); only once that's committed do we push
                // the work pointer onto the Redis queue for the drain cron.
                const emailJob = await prisma.$transaction(async (tx) => {
                  const job = await tx.emailJob.create({
                    data: {
                      to: sub.owner.email,
                      subject: tpl.subject,
                      html: tpl.html,
                      ...(tpl.text !== undefined ? { text: tpl.text } : {}),
                      status: 'PENDING',
                    },
                  });
                  await tx.subscription.update({
                    where: { id: sub.id },
                    data: {
                      reminderStage: stage,
                      reminderStageRenewsAt: sub.renewsAt,
                      ...(stage === 'expired' ? { status: 'EXPIRED' } : {}),
                    },
                  });
                  return job;
                });
                await queue.push({ emailJobId: emailJob.id });
                sent += 1;
              } catch (err) {
                // One subscription's failure (transient DB error, queue
                // hiccup) must not abort the whole tick — the rest of the
                // batch still needs to send and the tick's counts still
                // need to be logged/returned.
                log.error('subscription-renewal-reminders: failed for one subscription', {
                  subscriptionId: sub.id,
                  error: err instanceof Error ? err.message : String(err),
                  requestId: ctx.requestId,
                });
              }
            })(),
          );
        }

        await Promise.all(work);

        log.info('subscription-renewal-reminders tick', {
          scanned,
          sent,
          skippedSyntheticEmail,
          requestId: ctx.requestId,
        });
      },
    );

    return NextResponse.json(
      { ok: true, scanned, sent, skippedSyntheticEmail },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

// Vercel Cron invokes scheduled jobs with a GET request, not POST — this
// route was only reachable manually (curl -X POST) until now, so the real
// scheduled trigger has been silently 405ing in production. Alias GET to
// the same handler rather than rename POST, so existing tests/manual
// curl-based invocations keep working unchanged.
export const GET = POST;
