// POST /api/auth/resend-pending-email — 2026-09-03.
//
// Authenticated counterpart of /api/auth/resend-verification. That route is
// pre-session and enumeration-resistant (anonymous caller, body carries an
// email); this one already knows who's calling via requireAuth, so it just
// re-issues a code for the CALLER's own `pendingEmail`. No enumeration
// concern — you can't probe someone else's account state through your own
// session. Old codes are left to expire naturally (mirrors resend-verification).
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { requireAuth } from '@/lib/server/middleware';
import { createEmailLimiter } from '@/lib/server/middleware/rate-limit-by-email';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';
import { verifyCsrf, generateVerificationCode } from '@/lib/server/auth';
import { enqueueOutbox } from '@/lib/server/outbox';

const VERIFICATION_TTL_MS = Number(process.env.AUTH_VERIFICATION_TTL_MIN ?? 15) * 60 * 1000;

// Tight bucket, mirrors resend-verification: 3 resends per 15min.
const limiter = createEmailLimiter(redis ? { redis } : {}, {
  bucket: 'auth:resend-pending-email',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RESEND_RATE_LIMIT_MAX ?? 3),
  code: 'TOO_MANY_RESEND_ATTEMPTS',
  message: 'Too many resend attempts. Try again later.',
});

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

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { pendingEmail: true },
    });
    if (!user?.pendingEmail) {
      return jsonError('NO_PENDING_EMAIL', 400, ctx.requestId, 'No pending email to verify.');
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    const pendingEmail = user.pendingEmail;
    await prisma.$transaction(async (tx) => {
      await tx.verificationCode.create({
        data: { userId: auth.user.sub, code, type: 'EMAIL_VERIFY', expiresAt },
      });
      await enqueueOutbox(tx, {
        kind: 'email.verification_code',
        payload: { to: pendingEmail, code, expiresAt: expiresAt.toISOString() },
      });
    });

    log.info('resend-pending-email: code re-issued', { userId: auth.user.sub });
    const res = NextResponse.json({ ok: true });
    res.headers.set('x-request-id', ctx.requestId);
    return res;
  });
}
