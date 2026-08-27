// Jurali Phase 6 — POST /api/auth/phone-signup. Follows Inscription.jsx
// over the PRD's SMS-OTP prose (roadmap A.5/A.7, decided 2026-08-24): no
// SMS provider, no verification code — phone + password establishes a
// session immediately, mirroring email signup's structure but WITHOUT its
// enumeration resistance (a duplicate phone returns 409, not a fake 201 —
// deliberate divergence, see the roadmap's Phase 6 section).
//
// `User.email` stays required (auth.ts's TokenPayload/Context — both
// protected — assume `email: string`). Phone-only accounts get a
// synthetic, non-deliverable placeholder email instead of a schema change;
// see the comment on `User.email` in schema.prisma.
//
// CSRF carve-out: pre-session route, same as email signup — no CSRF cookie
// exists yet.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { zPhone } from '@/lib/server/zod-helpers';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createEmailLimiter } from '@/lib/server/middleware/rate-limit-by-email';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';
import {
  hashPassword,
  createAccessToken,
  createRefreshToken,
  setAuthCookies,
  setCsrfCookie,
} from '@/lib/server/auth';
import { isBanned } from '@/lib/server/auth/banned-passwords';
import { isPwned } from '@/lib/server/auth/hibp';
import { syntheticEmail } from '@/lib/server/auth/synthetic-email';
import { isUniqueConstraintViolation } from '@/lib/server/prisma-errors';

const PASSWORD_MIN = Number(process.env.AUTH_PASSWORD_MIN_LENGTH ?? 10);

const Body = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: zPhone,
  shopName: z.string().trim().min(1, 'Shop name is required'),
  password: z.string().min(1),
});

const limiter = createEmailLimiter(redis ? { redis } : {}, {
  bucket: 'auth:phone-signup',
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AUTH_PHONE_SIGNUP_RATE_LIMIT_MAX ?? 5),
  code: 'TOO_MANY_PHONE_SIGNUP_ATTEMPTS',
  message: 'Too many signup attempts. Try again later.',
});

function formatIssues(err: z.ZodError) {
  return err.issues.map((e) => ({ path: e.path.join('.'), message: e.message }));
}

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      const res = NextResponse.json(
        { error: 'VALIDATION_FAILED', issues: formatIssues(parsed.error) },
        { status: 400 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }
    const { name, phone, shopName, password } = parsed.data;

    if (isBanned(password)) {
      const res = NextResponse.json(
        { error: 'PASSWORD_BANNED', message: 'This password is too common.' },
        { status: 400 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }
    if (password.length < PASSWORD_MIN) {
      const res = NextResponse.json(
        {
          error: 'PASSWORD_TOO_SHORT',
          message: `Password must be at least ${PASSWORD_MIN} characters`,
        },
        { status: 400 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }
    if (process.env.PASSWORD_HIBP_CHECK === '1' && (await isPwned(password))) {
      const res = NextResponse.json(
        { error: 'PASSWORD_PWNED', message: 'This password appeared in a known data breach.' },
        { status: 400 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }

    const rateFail = await limiter.check(req, phone);
    if (rateFail) return rateFail;

    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (existing) {
      const res = NextResponse.json(
        { error: 'PHONE_ALREADY_EXISTS', message: 'This phone number is already registered.' },
        { status: 409 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await prisma.user.create({
        data: { email: syntheticEmail(phone), phone, name, shopName, passwordHash },
        select: { id: true, tokenVersion: true },
      });
    } catch (err) {
      // TOCTOU: two concurrent signups for the same phone can both pass the
      // `existing` pre-check above; the unique constraint on `phone` is the
      // real guard, and this turns its P2002 into the same graceful 409
      // instead of an uncaught 500.
      if (isUniqueConstraintViolation(err)) {
        const res = NextResponse.json(
          { error: 'PHONE_ALREADY_EXISTS', message: 'This phone number is already registered.' },
          { status: 409 },
        );
        res.headers.set('x-request-id', ctx.requestId);
        return res;
      }
      throw err;
    }

    const accessToken = await createAccessToken({
      sub: user.id,
      email: syntheticEmail(phone),
      tokenVersion: user.tokenVersion,
    });
    const refreshToken = await createRefreshToken(user.id, user.tokenVersion);
    await setAuthCookies(accessToken, refreshToken);
    await setCsrfCookie();

    log.info('phone-signup new user');
    const res = NextResponse.json({ ok: true, user: { sub: user.id, phone } }, { status: 201 });
    res.headers.set('x-request-id', ctx.requestId);
    return res;
  });
}
