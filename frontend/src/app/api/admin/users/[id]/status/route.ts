// ADMIN-01 / D-ADMIN-02 (Wave 2) — PATCH /api/admin/users/[id]/status
//
// ADMIN gates the route. Three states: ACTIVE | SUSPENDED | DELETED (a soft
// delete — login/refresh both refuse DELETED the same as SUSPENDED, but the
// data is retained and the transition is reversible, unlike a real
// cascading `prisma.user.delete()`). Restoring to ACTIVE from either
// SUSPENDED or DELETED, and moving a user INTO DELETED, both require
// SUPERADMIN — same bar as role changes, since both strip or restore
// authentication. Same-status PATCH is idempotent and writes NO
// AdminAction (T-03-06-08 mitigation: prevents audit-log noise).
//
// Sequence:
//   makeRequestContext → withRequestContext →
//     verifyCsrf (CF-02) → requireAdmin('ADMIN') (CF-08) →
//     enforceAdminRateLimit (D-ADMIN-05) → Zod parse →
//     prisma.$transaction(async tx => find → role-aware gate → update → logAdminAction)
//
// Audit metadata shape (per RESEARCH.md "AdminAction metadata shapes"):
//   user.suspend: { from, to: 'SUSPENDED', reason?: string }
//   user.delete:  { from, to: 'DELETED', reason?: string }
//   user.restore: { from, to: 'ACTIVE', reason?: string }
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  reason: z.string().min(1).max(500).optional(),
});

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'RESTORE_REQUIRES_SUPERADMIN' }
  | { kind: 'SUSPEND_REQUIRES_SUPERADMIN' }
  | { kind: 'DELETE_REQUIRES_SUPERADMIN' }
  | { kind: 'LAST_SUPERADMIN' }
  | { kind: 'OK'; user: { id: string; status: string } };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400 },
      );
    }
    const nextStatus = parsed.data.status;

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, status: true, email: true, name: true, role: true },
      });
      if (!target) return { kind: 'NOT_FOUND' as const };

      // Idempotent no-op: same status → return without writing AdminAction.
      // Mitigation T-03-06-08 (audit-log noise from repeated PATCH).
      if (target.status === nextStatus) {
        return {
          kind: 'OK' as const,
          user: { id: target.id, status: target.status },
        };
      }

      // Any transition INTO ACTIVE (from SUSPENDED or DELETED) is a
      // restore — only SUPERADMIN allowed (D-ADMIN-02).
      const isRestore = target.status !== 'ACTIVE' && nextStatus === 'ACTIVE';
      if (isRestore && auth.admin.role !== 'SUPERADMIN') {
        return { kind: 'RESTORE_REQUIRES_SUPERADMIN' as const };
      }

      // CR-01: ACTIVE → SUSPENDED on a SUPERADMIN target requires SUPERADMIN
      // actor. Without this an ADMIN could lock every higher-privilege account
      // out of the system in one PATCH (combined with the ACCOUNT_SUSPENDED
      // 403 on /api/auth/login + /api/auth/refresh), bypassing the
      // last-SUPERADMIN guard which only watches `User.role`. Mirrors the
      // CLAUDE.md rule "Only SUPERADMIN can change roles" — suspension is
      // functionally a role change because it strips authentication.
      const isSuspend = target.status === 'ACTIVE' && nextStatus === 'SUSPENDED';
      if (isSuspend && target.role === 'SUPERADMIN' && auth.admin.role !== 'SUPERADMIN') {
        return { kind: 'SUSPEND_REQUIRES_SUPERADMIN' as const };
      }

      // Soft-delete: same bar as suspend-a-SUPERADMIN, applied uniformly
      // regardless of the target's role — deleting an account is at least
      // as sensitive as suspending one.
      const isDelete = nextStatus === 'DELETED' && target.status !== 'DELETED';
      if (isDelete && auth.admin.role !== 'SUPERADMIN') {
        return { kind: 'DELETE_REQUIRES_SUPERADMIN' as const };
      }

      // Last-SUPERADMIN guard: deactivating (suspending or deleting) the
      // only remaining ACTIVE SUPERADMIN would lock everyone out of the
      // admin console — the same risk role-change's CF-09 guards against,
      // just reached via status instead of role.
      const deactivatingSuperadmin =
        target.role === 'SUPERADMIN' && target.status === 'ACTIVE' && nextStatus !== 'ACTIVE';
      if (deactivatingSuperadmin) {
        const activeSuperadminCount = await tx.user.count({
          where: { role: 'SUPERADMIN', status: 'ACTIVE' },
        });
        if (activeSuperadminCount <= 1) {
          return { kind: 'LAST_SUPERADMIN' as const };
        }
      }

      const updated = await tx.user.update({
        where: { id },
        data: { status: nextStatus },
        select: { id: true, status: true },
      });

      const action = isRestore ? 'user.restore' : isDelete ? 'user.delete' : 'user.suspend';
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action,
        targetType: 'User',
        targetId: id,
        metadata: {
          from: target.status,
          to: nextStatus,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        },
      });

      return { kind: 'OK' as const, user: updated };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404 },
      );
    }
    if (result.kind === 'RESTORE_REQUIRES_SUPERADMIN') {
      return NextResponse.json(
        {
          error: 'RESTORE_REQUIRES_SUPERADMIN',
          message: 'Only a SUPERADMIN can restore this account.',
        },
        { status: 403 },
      );
    }
    if (result.kind === 'SUSPEND_REQUIRES_SUPERADMIN') {
      return NextResponse.json(
        {
          error: 'SUSPEND_REQUIRES_SUPERADMIN',
          message: 'Only a SUPERADMIN can suspend a SUPERADMIN account.',
        },
        { status: 403 },
      );
    }
    if (result.kind === 'DELETE_REQUIRES_SUPERADMIN') {
      return NextResponse.json(
        {
          error: 'DELETE_REQUIRES_SUPERADMIN',
          message: 'Only a SUPERADMIN can delete an account.',
        },
        { status: 403 },
      );
    }
    if (result.kind === 'LAST_SUPERADMIN') {
      return NextResponse.json(
        {
          error: 'LAST_SUPERADMIN',
          message: 'Refuse to deactivate the last active SUPERADMIN.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ user: result.user }, { status: 200 });
  });
}
