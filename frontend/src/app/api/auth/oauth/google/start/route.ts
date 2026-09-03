// OAUTH-01 — GET /api/auth/oauth/google/start
//
// Issues state + PKCE-verifier cookies (httpOnly, path /api/auth/oauth,
// maxAge 900) and 302 redirects to Google's authorization URL. Inert
// (404) when GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI is missing — same
// env-gating pattern as Bictorys / R2 / Resend.
//
// Optional ?next= echoes a same-origin path through `app-oauth-next` so
// the callback can post-login redirect back to the originating page.
// Cross-origin or scheme-prefixed values are silently dropped (Pitfall 10
// in 02-RESEARCH.md — `//evil.com` is the classic open-redirect bypass).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { generateState, generateCodeVerifier } from 'arctic';
import { cookies } from 'next/headers';
import { tryCreateGoogleProvider } from '@/lib/server/oauth/google';
import { isSameOriginNext } from '@/lib/server/oauth/error-redirect';
import { optionalAuth } from '@/lib/server/middleware';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { log } from '@/lib/server/observability/log';

const COOKIE_PREFIX = process.env.COOKIE_PREFIX || 'app';
const OAUTH_STATE_COOKIE = `${COOKIE_PREFIX}-oauth-state`;
const OAUTH_PKCE_COOKIE = `${COOKIE_PREFIX}-oauth-pkce`;
const OAUTH_NEXT_COOKIE = `${COOKIE_PREFIX}-oauth-next`;
// Settings' "Lier mon compte Google" hits this same /start endpoint while
// already authenticated. Carrying the current user's id across the Google
// redirect lets the callback attach the Google identity to THIS user
// instead of falling through to the anonymous sign-in find-or-create,
// which would create a brand-new account and hijack the session if the
// Google email doesn't already match (always true for phone-signup
// accounts — see lib/server/auth/synthetic-email.ts). Fixed 2026-09-03.
const OAUTH_LINK_UID_COOKIE = `${COOKIE_PREFIX}-oauth-link-uid`;
// Was 5 min — real shopkeepers on a slow connection or a first-time Google
// signup (choosing an account, 2FA, reading the consent screen) routinely
// took longer than that, so the cookie expired before Google redirected
// back and the callback saw no state/pkce cookie → OAUTH_STATE_MISMATCH,
// a false "échec de connexion" for someone who did nothing wrong. Bumped
// 2026-09-03; still short-lived, single-use, httpOnly, and scoped to
// /api/auth/oauth.
const OAUTH_COOKIE_MAX_AGE = 15 * 60;

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const provider = tryCreateGoogleProvider();
    if (!provider) {
      // env-gated: 404 silently. Mirrors the Bictorys / R2 inert pattern.
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = provider.client.createAuthorizationURL(state, codeVerifier, [...provider.scopes]);

    const store = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax' as const,
      path: '/api/auth/oauth',
      maxAge: OAUTH_COOKIE_MAX_AGE,
    };
    store.set(OAUTH_STATE_COOKIE, state, cookieOpts);
    store.set(OAUTH_PKCE_COOKIE, codeVerifier, cookieOpts);

    const auth = await optionalAuth();
    if (auth) {
      store.set(OAUTH_LINK_UID_COOKIE, auth.user.sub, cookieOpts);
    }

    const nextParam = req.nextUrl.searchParams.get('next');
    const appUrl = process.env.APP_URL ?? '';
    if (nextParam && appUrl) {
      const validated = isSameOriginNext(nextParam, appUrl);
      if (validated) {
        store.set(OAUTH_NEXT_COOKIE, validated, cookieOpts);
      } else {
        log.warn('oauth.start: rejected cross-origin ?next=', { next: nextParam });
      }
    }

    return NextResponse.redirect(url.toString(), 302);
  });
}
