// GET /api/auth/me — AUTH-06.
//
// Source: RESEARCH.md Pattern 14.
//
// requireAuth handles the cookie/Bearer lookup, JWT verification, and the
// DB-side tokenVersion re-check (T-1-02 mitigation against stale-JWT bypass
// after change-password bumps tokenVersion). Returns AuthContext on success
// or a 401 NextResponse on failure.
//
// Extra fields beyond { sub, email } (id, emailVerifiedAt, createdAt,
// updatedAt, hasPassword, linkedProviders) are fetched via a second DB hit
// so the AuthContext / settings page can branch on them without an extra
// round-trip. `hasPassword` distinguishes OAuth-only accounts (passwordHash
// is null) — used by /settings to switch between "Set password" and
// "Change password". `linkedProviders` is a string[] of provider names
// already wired (e.g. ['google']).
//
// No CSRF: GET is a safe method; verifyCsrf is a no-op for GET anyway.
export const runtime = 'nodejs';

import 'server-only';
import { z } from 'zod';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { zPhone } from '@/lib/server/zod-helpers';
import { isSyntheticEmail, syntheticEmail } from '@/lib/server/auth/synthetic-email';

// Phase 9 — desktop /settings "Modifier" button (Parametres.jsx's "Profil
// & Boutique"). All fields optional/independent (partial update).
const PatchBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  shopName: z.string().trim().min(1).max(120).optional(),
  phone: z.union([zPhone, z.literal('')]).optional(),
  address: z.union([z.string().trim().min(1).max(200), z.literal('')]).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth(req.headers.get('authorization'));
    if (auth instanceof NextResponse) {
      auth.headers.set('x-request-id', ctx.requestId);
      return auth;
    }

    // Defensive shape: tests sometimes stub findUnique with a minimal
    // `{ id, email, tokenVersion }` payload (the requireAuth contract).
    // We only read fields we know are present, and default the rest.
    const dbUser = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
        shopName: true,
        name: true,
        phone: true,
        address: true,
        oauthAccounts: { select: { provider: true } },
      },
    });

    const user = {
      // Keep `sub` for back-compat with the AuthContext payload contract
      // (older callers may still read it). New code should use `id`.
      sub: auth.user.sub,
      id: dbUser?.id ?? auth.user.sub,
      email: dbUser?.email ?? auth.user.email,
      emailVerifiedAt: dbUser?.emailVerifiedAt
        ? dbUser.emailVerifiedAt instanceof Date
          ? dbUser.emailVerifiedAt.toISOString()
          : dbUser.emailVerifiedAt
        : null,
      createdAt: dbUser?.createdAt
        ? dbUser.createdAt instanceof Date
          ? dbUser.createdAt.toISOString()
          : dbUser.createdAt
        : null,
      updatedAt: dbUser?.updatedAt
        ? dbUser.updatedAt instanceof Date
          ? dbUser.updatedAt.toISOString()
          : dbUser.updatedAt
        : null,
      hasPassword: !!dbUser?.passwordHash,
      linkedProviders: (dbUser?.oauthAccounts ?? []).map((a) => a.provider),
      shopName: dbUser?.shopName ?? null,
      name: dbUser?.name ?? null,
      phone: dbUser?.phone ?? null,
      address: dbUser?.address ?? null,
    };

    return NextResponse.json({ user }, { status: 200, headers: { 'x-request-id': ctx.requestId } });
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth(req.headers.get('authorization'));
    if (auth instanceof NextResponse) {
      auth.headers.set('x-request-id', ctx.requestId);
      return auth;
    }

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

    const data: Record<string, string | null> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.shopName !== undefined) data.shopName = parsed.data.shopName;
    if (parsed.data.address !== undefined) data.address = parsed.data.address || null;

    if (parsed.data.phone !== undefined) {
      const nextPhone = parsed.data.phone || null;

      const current = await prisma.user.findUnique({
        where: { id: auth.user.sub },
        select: {
          phone: true,
          email: true,
          emailVerifiedAt: true,
          oauthAccounts: { select: { provider: true }, take: 1 },
        },
      });

      // Phone-only accounts (synthetic email, never verified, no OAuth
      // linked) have no other way to sign back in — clearing the phone
      // would permanently lock the account out.
      if (!nextPhone && current && !current.emailVerifiedAt && current.oauthAccounts.length === 0) {
        return NextResponse.json(
          {
            error: 'PHONE_REQUIRED',
            message: 'Remove your phone number after setting a verified email or linking Google.',
          },
          { status: 409, headers: { 'x-request-id': ctx.requestId } },
        );
      }

      if (nextPhone && nextPhone !== current?.phone) {
        const existing = await prisma.user.findFirst({
          where: { phone: nextPhone, id: { not: auth.user.sub } },
          select: { id: true },
        });
        if (existing) {
          return NextResponse.json(
            { error: 'PHONE_ALREADY_EXISTS', message: 'This phone number is already registered.' },
            { status: 409, headers: { 'x-request-id': ctx.requestId } },
          );
        }

        // Keep the 1:1 phone->synthetic-email mapping in sync so the old
        // phone number is safe to reassign to another account afterwards.
        if (current?.email && isSyntheticEmail(current.email)) {
          data.email = syntheticEmail(nextPhone);
        }
      }

      data.phone = nextPhone;
    }

    const updated = await prisma.user.update({
      where: { id: auth.user.sub },
      data,
      select: { name: true, shopName: true, phone: true, address: true },
    });

    return NextResponse.json({ user: updated }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
