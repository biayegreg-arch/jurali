// GET/POST /api/admin/coupons — Premium checkout discount codes.
//
// GET is ADMIN-readable (same bar as /api/admin/config's GET). POST is
// SUPERADMIN-only, same bar as /api/admin/config's PATCH (both affect what
// a customer is charged). No pagination cursor for now — coupon lists stay
// small in practice; `take` is capped as a fat-finger guard, not a real
// pagination story.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin, requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const LIST_TAKE = 100;

const CreateBody = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Alphanumeric, dash, underscore only'),
  percentOff: z.number().int().min(1).max(100),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      take: LIST_TAKE,
      select: {
        id: true,
        code: true,
        percentOff: true,
        active: true,
        expiresAt: true,
        redemptionCount: true,
        createdAt: true,
        createdBy: { select: { email: true } },
      },
    });

    return NextResponse.json({ items: coupons }, { headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
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

    const code = parsed.data.code.toUpperCase();
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: 'COUPON_CODE_TAKEN', message: 'A coupon with this code already exists.' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const coupon = await prisma.$transaction(async (tx) => {
      const row = await tx.coupon.create({
        data: {
          code,
          percentOff: parsed.data.percentOff,
          expiresAt,
          createdById: auth.admin.id,
        },
      });
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'coupon.create',
        targetType: 'Coupon',
        targetId: row.id,
        metadata: { code, percentOff: parsed.data.percentOff, expiresAt: parsed.data.expiresAt },
      });
      return row;
    });

    return NextResponse.json(
      {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          percentOff: coupon.percentOff,
          active: coupon.active,
          expiresAt: coupon.expiresAt,
          redemptionCount: coupon.redemptionCount,
          createdAt: coupon.createdAt,
        },
      },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
