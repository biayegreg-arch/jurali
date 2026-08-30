import { NextResponse, type NextRequest } from 'next/server';

// Silent-refresh gate for protected pages, PLUS a Content-Security-Policy
// applied to every page response (the matcher below already excludes /api
// and static assets, which don't need CSP).
//
// The (15-min) access cookie can expire while a (7-day) refresh cookie is
// still valid — typically when a tab sat unfocused or the laptop slept. The
// (authed) layout calling /api/auth/me would 401 and the user would be kicked
// to /login. This middleware catches that case BEFORE the page renders and
// bounces the request through /api/auth/refresh-and-return, which mints fresh
// cookies and 302s back to the original URL — invisible to the user.
//
// Protected paths are configured via AUTH_PROTECTED_PREFIXES (comma-separated,
// e.g. "/dashboard,/account"). Empty by default — the API surface is the only
// thing shipped, so out-of-the-box this middleware is a no-op.
//
// CSP script-src uses 'unsafe-inline' rather than a nonce — see the comment
// above buildCsp() for why a nonce doesn't survive this Turbopack build's
// own inline hydration scripts.
//
// Edge runtime: no DB, no bcrypt, no Prisma. We only inspect cookies and
// build redirects — the heavy lifting happens in /api/auth/refresh-and-return
// (runtime=nodejs).

const COOKIE_PREFIX = process.env.COOKIE_PREFIX || 'app';
const ACCESS_COOKIE = `${COOKIE_PREFIX}-token`;
const REFRESH_COOKIE = `${COOKIE_PREFIX}-refresh`;
const LOGIN_PATH = process.env.AUTH_LOGIN_PATH || '/login';

const AUTHED_PREFIXES = (process.env.AUTH_PROTECTED_PREFIXES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAuthedPath(pathname: string): boolean {
  return AUTHED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Sentry's browser SDK ships error/replay events straight to its ingest
// host (no tunnelRoute configured — see next.config.ts) — connect-src must
// allow it whenever NEXT_PUBLIC_SENTRY_DSN is set. Wildcarded since the
// exact ingest subdomain varies by Sentry org/region.
//
// script-src uses 'unsafe-inline' instead of a nonce, and deliberately
// omits 'strict-dynamic'. Reasoning, found the hard way in production:
//
// 1. 'strict-dynamic' makes browsers ignore 'self' entirely and trust ONLY
//    nonce'd scripts. This Turbopack build never threads the nonce onto
//    Next's own /_next/static bootstrap <script src> tags (confirmed: 0 of
//    17 carried one), so 'strict-dynamic' blocked every external script on
//    every page.
// 2. Dropping 'strict-dynamic' fixed pages with no server-streamed data
//    (/, /login) because 'self' covers same-origin <script src> chunks
//    regardless of nonce. But pages that stream RSC payloads to the client
//    (e.g. /dashboard) emit several INLINE <script>self.__next_f.push(...)
//    </script> tags carrying that data — inline scripts are never covered
//    by 'self', only by a matching nonce or 'unsafe-inline'. Next.js is
//    documented to auto-nonce those internal inline scripts, but doesn't
//    in this Turbopack build either (confirmed via browser console: 8
//    blocked inline-script CSP violations on /dashboard, zero carrying a
//    nonce) — every authenticated page was hydration-dead, not just the
//    ones this file's own diff had touched.
// A nonce and 'unsafe-inline' in the same directive is a no-op ('unsafe-inline'
// is ignored whenever a nonce-source is present), so we drop the nonce
// entirely rather than ship a directive that silently does nothing.
function buildCsp(): string {
  return `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function proxy(req: NextRequest): NextResponse {
  const csp = buildCsp();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('Content-Security-Policy', csp);
  const nextInit = { request: { headers: requestHeaders } };

  function withCsp(res: NextResponse): NextResponse {
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  if (AUTHED_PREFIXES.length === 0) return withCsp(NextResponse.next(nextInit));

  const { pathname, search } = req.nextUrl;
  if (!isAuthedPath(pathname)) return withCsp(NextResponse.next(nextInit));

  if (req.cookies.get(ACCESS_COOKIE)?.value) return withCsp(NextResponse.next(nextInit));

  const target = pathname + search;

  if (!req.cookies.get(REFRESH_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = `?next=${encodeURIComponent(target)}`;
    return withCsp(NextResponse.redirect(url, 303));
  }

  const url = req.nextUrl.clone();
  url.pathname = '/api/auth/refresh-and-return';
  url.search = `?next=${encodeURIComponent(target)}`;
  return withCsp(NextResponse.redirect(url, 303));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\..*).*)'],
};
