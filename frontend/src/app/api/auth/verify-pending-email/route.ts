// POST /api/auth/verify-pending-email — 2026-09-03.
//
// Confirms the optional email a phone-signup account added after the fact
// (see /api/auth/phone-signup's `pendingEmail`). Authenticated counterpart
// of /api/auth/verify-email: that route is pre-session and enumeration-
// resistant by design (anonymous caller, so user-not-found and code-not-found
// must look identical); this one already knows exactly who's calling via
// requireAuth, so it looks up the CURRENT user's own pendingEmail/code
// directly instead of trusting an email in the body.
//
// On success, promotes `pendingEmail` -> `email`, sets `emailVerifiedAt`,
// clears `pendingEmail`, all inside the same transaction that consumes the
// code (TOCTOU-safe, mirrors verify-email's updateMany-guarded pattern).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { requireAuth } from '@/lib/server/middleware';
import { createEmailLimiter } from '@/lib/server/middleware/rate-limit-by-email';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';
import { VERIFICATION_CODE_REGEX, verifyCsrf, timingSafeCompare } from '@/lib/server/auth';
import { isUniqueConstraintViolation } from '@/lib/server/prisma-errors';

const Body = z.object({
  code: z.string().regex(VERIFICATION_CODE_REGEX, 'Invalid verification code format'),
});

const limiter = createEmailLimiter(redis ? { redis } : {}, {
  bucket: 'auth:verify-pending-email',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_VERIFY_RATE_LIMIT_MAX ?? 5),
  code: 'TOO_MANY_VERIFY_ATTEMPTS',
  message: 'Too many verification attempts. Try again later.',
});

function formatIssues(err: z.ZodError) {
  return err.issues.map((e) => ({ path: e.path.join('.'), message: e.message }));
}

function jsonError(
  code: string,
  status: number,
  requestId: string,
  message?: string,
): NextResponse {
  const res = NextResponse.json({ error: code, ...(message ? { message } : {}) }, { status });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) {
      csrfFail.headers.set('x-request-id', ctx.requestId);
      return csrfFail;
    }

    const auth = await requireAuth(req.headers.get('authorization'));
    if (auth instanceof NextResponse) {
      auth.headers.set('x-request-id', ctx.requestId);
      return auth;
    }

    const rateFail = await limiter.check(req, auth.user.sub);
    if (rateFail) return rateFail;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', issues: formatIssues(parsed.error) },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const { code } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { pendingEmail: true },
    });
    if (!user?.pendingEmail) {
      return jsonError('NO_PENDING_EMAIL', 400, ctx.requestId, 'No pending email to verify.');
    }

    const codeRow = await prisma.verificationCode.findFirst({
      where: { userId: auth.user.sub, code, type: 'EMAIL_VERIFY', usedAt: null },
      select: { id: true, code: true, expiresAt: true },
    });
    if (!codeRow) {
      return jsonError(
        'VERIFICATION_CODE_INVALID',
        400,
        ctx.requestId,
        'Verification code is invalid.',
      );
    }
    if (codeRow.expiresAt.getTime() < Date.now()) {
      return jsonError(
        'VERIFICATION_CODE_EXPIRED',
        400,
        ctx.requestId,
        'Verification code has expired.',
      );
    }
    if (!timingSafeCompare(code, codeRow.code)) {
      return jsonError(
        'VERIFICATION_CODE_INVALID',
        400,
        ctx.requestId,
        'Verification code is invalid.',
      );
    }

    const pendingEmail = user.pendingEmail;
    try {
      await prisma.$transaction(async (tx) => {
        const consumed = await tx.verificationCode.updateMany({
          where: { id: codeRow.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (consumed.count === 0) {
          throw new Error('VERIFICATION_CODE_RACE');
        }
        await tx.user.update({
          where: { id: auth.user.sub },
          data: { email: pendingEmail, emailVerifiedAt: new Date(), pendingEmail: null },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'VERIFICATION_CODE_RACE') {
        return jsonError(
          'VERIFICATION_CODE_INVALID',
          400,
          ctx.requestId,
          'Verification code is invalid.',
        );
      }
      // Someone else claimed this email between signup and confirmation —
      // the code stays unconsumed (transaction rolled back) so the user can
      // retry with a different email via resend-pending-email.
      if (isUniqueConstraintViolation(err)) {
        return jsonError(
          'EMAIL_ALREADY_REGISTERED',
          409,
          ctx.requestId,
          'This email is already registered to another account.',
        );
      }
      throw err;
    }

    log.info('verify-pending-email success', { userId: auth.user.sub });
    const res = NextResponse.json({ ok: true, email: pendingEmail });
    res.headers.set('x-request-id', ctx.requestId);
    return res;
  });
}
