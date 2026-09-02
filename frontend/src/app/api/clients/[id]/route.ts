// GET /api/clients/[id] — fiche client (PRD 3.6): balance + full
// chronological transaction history, most recent first (US-04).
//
// 404 CLIENT_NOT_FOUND both when the row doesn't exist AND when it belongs
// to a different owner — never distinguish the two on the wire, same
// existence-leak principle CLAUDE.md documents for org membership.
export const runtime = 'nodejs';

import 'server-only';
import { z } from 'zod';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { computeClientBalance, isOverdue as computeIsOverdue } from '@/lib/server/jurali/balance';
import { requireOwnedClient } from '@/lib/server/jurali/clients';
import { isRecordNotFound } from '@/lib/server/prisma-errors';
import { zPhone, zEmail } from '@/lib/server/zod-helpers';

// Phase 9 — desktop "Fiche client"'s "Modifier" button. All fields
// optional/independent (partial update) — an empty string clears
// email/address (distinct from omitting the key, which leaves it
// untouched); firstName can't be cleared (still required, matches POST).
const PatchBody = z.object({
  firstName: z.string().trim().min(1).max(120).optional(),
  phone: z.union([zPhone, z.literal('')]).optional(),
  email: z.union([zEmail, z.literal('')]).optional(),
  address: z.union([z.string().trim().min(1).max(200), z.literal('')]).optional(),
  // Per-client reminder overrides (Premium-gated in the UI) — null means
  // "use the account-wide default" (AUTO_REMINDER_THRESHOLD_DAYS /
  // OVERDUE_ALERT_THRESHOLD_DAYS).
  autoReminderEnabled: z.boolean().optional(),
  autoReminderThresholdDays: z.number().int().min(1).max(90).nullable().optional(),
  overdueAlertThresholdDays: z.number().int().min(1).max(90).nullable().optional(),
});

export async function GET(
  req: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await routeCtx.params;
    const found = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        firstName: true,
        phone: true,
        email: true,
        address: true,
        createdAt: true,
        lastReminderSentAt: true,
        autoReminderEnabled: true,
        autoReminderThresholdDays: true,
        overdueAlertThresholdDays: true,
        transactions: {
          select: { id: true, type: true, amountFcfa: true, note: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const client = requireOwnedClient(found, auth.user.sub, ctx.requestId);
    if (client instanceof NextResponse) return client;

    // Prisma's `type` column is a plain String (see schema.prisma comment);
    // cast once since every row was written through POST /api/transactions'
    // `z.enum(['DEBT', 'PAYMENT'])` contract.
    const chronological = [...client.transactions]
      .reverse()
      .map((t) => ({ ...t, type: t.type as 'DEBT' | 'PAYMENT' }));
    const balanceFcfa = computeClientBalance(chronological);
    const overdue = computeIsOverdue(chronological);

    return NextResponse.json(
      {
        id: client.id,
        firstName: client.firstName,
        phone: client.phone,
        email: client.email,
        address: client.address,
        createdAt: client.createdAt,
        lastReminderSentAt: client.lastReminderSentAt,
        autoReminderEnabled: client.autoReminderEnabled,
        autoReminderThresholdDays: client.autoReminderThresholdDays,
        overdueAlertThresholdDays: client.overdueAlertThresholdDays,
        balanceFcfa,
        isOverdue: overdue,
        transactions: client.transactions,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

export async function PATCH(
  req: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await routeCtx.params;
    const found = await prisma.client.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
    const existing = requireOwnedClient(found, auth.user.sub, ctx.requestId);
    if (existing instanceof NextResponse) return existing;

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          issues: parsed.error.issues,
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const data: Record<string, string | number | boolean | null> = {};
    if (parsed.data.firstName !== undefined) data.firstName = parsed.data.firstName;
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;
    if (parsed.data.email !== undefined) data.email = parsed.data.email || null;
    if (parsed.data.address !== undefined) data.address = parsed.data.address || null;
    if (parsed.data.autoReminderEnabled !== undefined) {
      data.autoReminderEnabled = parsed.data.autoReminderEnabled;
    }
    if (parsed.data.autoReminderThresholdDays !== undefined) {
      data.autoReminderThresholdDays = parsed.data.autoReminderThresholdDays;
    }
    if (parsed.data.overdueAlertThresholdDays !== undefined) {
      data.overdueAlertThresholdDays = parsed.data.overdueAlertThresholdDays;
    }

    const updated = await prisma.client.update({
      where: { id },
      data,
      select: {
        id: true,
        firstName: true,
        phone: true,
        email: true,
        address: true,
        autoReminderEnabled: true,
        autoReminderThresholdDays: true,
        overdueAlertThresholdDays: true,
      },
    });

    return NextResponse.json(updated, { headers: { 'x-request-id': ctx.requestId } });
  });
}

// Desktop/mobile debtor-list "Supprimer" action. Transaction rows cascade
// via Prisma's `onDelete: Cascade` on Transaction.client, so no manual
// cleanup is needed here.
export async function DELETE(
  req: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await routeCtx.params;
    const found = await prisma.client.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
    const existing = requireOwnedClient(found, auth.user.sub, ctx.requestId);
    if (existing instanceof NextResponse) return existing;

    try {
      await prisma.client.delete({ where: { id } });
    } catch (err) {
      // The ownership lookup above and this delete aren't in one
      // transaction — a second concurrent DELETE for the same client
      // (double-click, or two tabs) can see the row vanish in between and
      // hit Prisma's P2025 here. Same 404 shape as "never existed", not a
      // 500 — the end state (client gone) is identical either way.
      if (isRecordNotFound(err)) {
        return NextResponse.json(
          { error: 'CLIENT_NOT_FOUND', message: 'Client not found' },
          { status: 404, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      throw err;
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
