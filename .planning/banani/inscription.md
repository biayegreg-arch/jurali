# Inscription — Banani → Next.js/Tailwind

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/Inscription.jsx`
- Fetched: 2026-08-24 (Phase 5 backlog item, unblocked by Phase 6's
  `/api/auth/phone-signup`)
- `screenSize: 'desktop'` — 2-panel layout (560px brand/illustration panel
  + centered form). Built mobile-first per skill rule.

## System context
- Route: `/signup` (new). Public (no auth gate).
- Data written: `POST /api/auth/phone-signup` (Phase 6, already built +
  tested) — `{name, phone, shopName, password}`. Issues cookies directly
  on success (no separate verification step — see roadmap Phase 6).
- Navigation: success → `refresh()` (AuthContext) then `router.push('/')`
  (dashboard). "Se connecter" link → `/login` (see companion page below).
- Fields match the design exactly: Nom complet, Téléphone (+221 fixed
  prefix + local number), Nom de ta boutique, Mot de passe. No confirm-
  password field in the design — none added.

## Component breakdown
- **NEW** `frontend/src/app/signup/page.tsx` — the form, mobile-first.
- **NEW** `frontend/src/app/login/page.tsx` — companion phone-login page.
  Not a Banani screen (none exists/selected) — same treatment as Phase
  4's Paiement reçu: built fresh in the Jurali visual system, reusing the
  same form-field styling as signup. Necessary because (a) Inscription's
  own "Se connecter" link needs a destination, and (b) `useUser()`
  app-wide already redirects to `/login` on logout — that redirect
  target has been a 404 since Phase 4; this closes the loop.
- **REUSE** `Icon`

## Responsive plan
- **375px (base)**: single column, form only. The left brand/illustration
  panel (testimonial, mock receipt card, footer) doesn't fit at mobile
  width and is Banani's desktop flourish, not functional content — it's
  dropped entirely below `lg:`, replaced by a compact "Jurali" wordmark
  + tagline at the top of the form column.
- **lg (1024px+)**: reproduces Banani's 2-panel layout — 560px primary-
  colored brand panel (wordmark, mock receipt preview, testimonial) +
  centered form on the right.

## Decisions (2026-08-24, applying the session's established precedent)
- **Terms checkbox** ("J'accepte les conditions d'utilisation…") — kept
  as a required, client-side-only gate (submit disabled until checked).
  Not persisted server-side — no PRD requirement for consent-timestamp
  tracking, no schema field for it; adding one would be scope creep for
  an MVP with no drafted ToS page to link to. The links themselves are
  inert placeholders (`<span>`, not `<a href>`) since no `/terms` /
  `/privacy` pages exist yet.
- **Mock receipt card / testimonial content** — kept as static decorative
  content on the desktop brand panel (matches the design 1:1), not real
  data — same treatment as any marketing illustration.
- **`/login` page** — built as a companion (see above), phone + password
  only, same visual language as `/signup`, no Banani source.

## Implementation checklist
- [x] `frontend/src/app/signup/page.tsx`
- [x] `frontend/src/app/login/page.tsx`
- [x] 375 / 1024+ layout check
- [x] Wire phone-signup + phone-login, error code mapping
  (`PHONE_ALREADY_EXISTS`, `PASSWORD_TOO_SHORT`, `PASSWORD_BANNED`,
  `INVALID_CREDENTIALS`, `LOCKED_OUT`, `ACCOUNT_SUSPENDED`,
  `TOO_MANY_PHONE_SIGNUP_ATTEMPTS`, `TOO_MANY_PHONE_LOGIN_ATTEMPTS`)
- [x] Lint / typecheck / build

## Google Sign-in button (2026-08-25)

User request: connect Resend + Google OAuth to test login/dashboard. The
backend OAuth routes (`api/auth/oauth/google/{start,callback}`, Phase 2,
PROTECTED — not touched) already existed but nothing in the UI linked to
them — both `/login` and `/signup` already had an inert "ou" divider with
nothing after it. Confirmed with the user (AskUserQuestion) before adding
UI: they want a real, clickable button, not just the env keys documented.

- **NEW** `components/jurali/GoogleIcon.tsx` — official 4-color "G"
  logomark as an inline SVG. Not in lucide-react (a generic icon set, no
  brand marks) so it doesn't go through `<Icon i="..." />`.
- **NEW** `components/jurali/GoogleSignInButton.tsx` — plain `<a
  href="/api/auth/oauth/google/start?next={next}">`, not a client-side
  `router.push`: the browser must actually follow the 302 chain out to
  accounts.google.com, which a SPA navigation can't do. One button covers
  both `/login` and `/signup` — the callback's find-or-create-by-email
  (OAUTH-02/03) already handles new vs. returning users identically, so
  "Continuer avec Google" is accurate copy for both pages. `next="/dashboard"`
  on both, so a successful login lands straight on the dashboard (the
  callback honors `?next=` when present, falls back to `APP_URL`
  otherwise — see `oauth/google/start/route.ts`'s doc comment).
- Slotted into the existing empty space right after each page's "ou"
  divider — no layout restructuring.
- **Env-gated exactly like every other optional provider in this kit**:
  with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` empty (the state at
  build time here), `GET /api/auth/oauth/google/start` 404s — confirmed
  live against the dev server. The button becomes functional the moment
  those two env vars are filled in; no code change needed on the user's
  side beyond that.
- Verified: typecheck/lint/format/build all clean. Live dev-server check
  confirmed the button renders server-side on both `/login` and `/signup`
  with the correct `href` (`oauth/google/start?next=%2Fdashboard`), and
  that the start route correctly 404s while the Google keys are unset.
  **Not verified**: the actual click → Google consent screen → callback →
  dashboard round trip, since that requires real `GOOGLE_CLIENT_ID`/
  `GOOGLE_CLIENT_SECRET` values the user hasn't filled in yet, plus a
  real browser (no browser-automation tool available in this
  environment) — same standing limitation as every other client-only
  piece this session.
- [x] `GoogleIcon.tsx` + `GoogleSignInButton.tsx`
- [x] Wired into `/login` and `/signup`
- [x] typecheck/lint/format/build clean
- [x] Confirmed inert (404) with keys unset, confirmed markup renders
- [ ] Full click-through with real Google credentials — pending the user
      filling in `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, not verifiable
      here
