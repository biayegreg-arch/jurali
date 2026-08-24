// GET/PATCH /api/settings/auto-reminders — Jurali Phase 9. Single global
// on/off for the auto-reminder cron (Parametres.jsx's "Rappels WhatsApp
// automatiques"). A dedicated route rather than folding into
// `NotificationPreferences.prefs`: that JSON blob's documented contract is
// "missing event-type ⇒ enabled" (opt-out, per-channel delivery
// preference for an event that's already firing) — the inverse of what
// this needs (a business-logic gate that must default OFF since existing
// users never consented, distinct from "email vs in-app" channel choice).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PatchBody = z.object({ enabled: z.boolean() });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { autoReminderEnabled: true },
    });

    return NextResponse.json(
      { enabled: user?.autoReminderEnabled ?? false },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const updated = await prisma.user.update({
      where: { id: auth.user.sub },
      data: { autoReminderEnabled: parsed.data.enabled },
      select: { autoReminderEnabled: true },
    });

    return NextResponse.json(
      { enabled: updated.autoReminderEnabled },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
