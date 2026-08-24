// Jurali Phase 6 — POST /api/auth/phone-login. Mirrors /api/auth/login's
// sequence (Pattern 9 + Pattern 8 constant-time error path + Pattern 10
// lockout) keyed by phone instead of email, with ONE deliberate omission:
// no `emailVerifiedAt` check — phone accounts never verify an email (none
// is collected), so the field is meaningless here. See roadmap Phase 6.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  createAccessToken,
  createRefreshToken,
  setAuthCookies,
  setCsrfCookie,
  verifyPassword,
} from '@/lib/server/auth';
import { isLockedOut, recordFailure, recordSuccess } from '@/lib/server/auth/lockout';
import { dummyBcryptCompare } from '@/lib/server/auth/dummy-bcrypt';
import { createEmailLimiter } from '@/lib/server/middleware/rate-limit-by-email';
import { getRedis } from '@/lib/server/redis';
import { prisma } from '@/lib/server/prisma';
import { zPhone } from '@/lib/server/zod-helpers';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';

const LoginSchema = z.object({
  phone: zPhone,
  password: z.string().min(1),
});

const redis = getRedis() ?? undefined;
const limiter = createEmailLimiter(
  { ...(redis ? { redis } : {}) },
  {
    bucket: 'auth:phone-login',
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_PHONE_LOGIN_RATE_LIMIT_MAX ?? 10),
    code: 'TOO_MANY_PHONE_LOGIN_ATTEMPTS',
    message: 'Too many login attempts. Try again later.',
  },
);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid JSON body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }
    const { phone, password } = parsed.data;

    const rl = await limiter.check(req, phone);
    if (rl) {
      rl.headers.set('x-request-id', ctx.requestId);
      return rl;
    }

    if (await isLockedOut(phone)) {
      log.warn('phone-login blocked by lockout', { phone });
      return NextResponse.json(
        { error: 'LOCKED_OUT', message: 'Account temporarily locked.' },
        { status: 423, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        tokenVersion: true,
        status: true,
      },
    });

    if (!user || !user.passwordHash) {
      await dummyBcryptCompare(password);
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: 'Invalid phone or password.' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const r = await recordFailure(phone);
      if (r.locked) {
        return NextResponse.json(
          { error: 'LOCKED_OUT', message: 'Account temporarily locked.' },
          { status: 423, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: 'Invalid phone or password.' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    if (user.status === 'SUSPENDED') {
      await recordSuccess(phone);
      return NextResponse.json(
        {
          error: 'ACCOUNT_SUSPENDED',
          message: 'This account has been suspended. Contact support.',
        },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    await recordSuccess(phone);

    const accessToken = await createAccessToken({
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    });
    const refreshToken = await createRefreshToken(user.id, user.tokenVersion);
    await setAuthCookies(accessToken, refreshToken);
    await setCsrfCookie();

    return NextResponse.json(
      { ok: true, user: { sub: user.id, phone } },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
