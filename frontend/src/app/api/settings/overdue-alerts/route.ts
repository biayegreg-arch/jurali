// GET/PATCH /api/settings/overdue-alerts — Jurali Phase 9. Single global
// on/off for the daily "clients overdue 14+ days" digest cron
// (Parametres.jsx's "Notifications dettes en retard"). Mirrors
// /api/settings/auto-reminders exactly — a distinct field/route because
// this is a different cadence (daily digest vs. per-client 7-day nudge),
// not a variant of the same setting.
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
      select: { overdueAlertsEnabled: true },
    });

    return NextResponse.json(
      { enabled: user?.overdueAlertsEnabled ?? false },
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
      data: { overdueAlertsEnabled: parsed.data.enabled },
      select: { overdueAlertsEnabled: true },
    });

    return NextResponse.json(
      { enabled: updated.overdueAlertsEnabled },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
