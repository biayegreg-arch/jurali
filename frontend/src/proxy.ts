import { NextResponse, type NextRequest } from 'next/server';

// Silent-refresh gate for protected pages, PLUS a nonce-based
// Content-Security-Policy applied to every page response (the matcher below
// already excludes /api and static assets, which don't need CSP).
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
// CSP: a fresh nonce is minted per request and exposed to Server Components
// via the `x-nonce` request header (`(await headers()).get('x-nonce')`) so
// any inline <script> (e.g. JSON-LD structured data) can carry a matching
// `nonce` attribute — CSP's script-src covers ALL <script> tags regardless
// of `type`, JSON-LD included. Next.js's own hydration scripts pick up the
// nonce automatically once it sees `nonce-...` in the CSP header on the
// incoming request — no extra wiring needed for those.
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
// script-src deliberately does NOT use 'strict-dynamic': that directive
// makes browsers ignore the 'self' allowlist entirely and trust ONLY
// nonce'd scripts (plus scripts a nonce'd script injects at runtime) —
// this Turbopack build does not thread the nonce onto Next's own
// /_next/static bootstrap <script> tags, so 'strict-dynamic' blocked every
// script on every page (confirmed: 0 of 17 <script> tags carried a nonce
// in production). 'self' already covers those same-origin chunks fine;
// the nonce here exists only for our own inline JSON-LD <script>.
function buildCsp(nonce: string): string {
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
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
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
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
