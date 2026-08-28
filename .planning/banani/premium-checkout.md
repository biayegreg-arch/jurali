# S'abonner Premium — Banani → Next.js/Tailwind

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/SAbonnerPremium.jsx`
- Fetched: 2026-08-28
- `screenSize: 'desktop'` — sidebar + 2-column body. Built mobile-first.

## System context
- Route: `/premium/checkout` (new), auth-gated (`useUser()`).
- Reached from `/premium`'s "Passer à Premium" button (now a `Link`, not
  a direct `POST`) — `/premium` stays the free-tier pricing/comparison
  page unchanged.
- Data: `GET /api/subscriptions` (existing) to redirect away if already
  active (this screen is for going from Gratuit → Premium, not repeat
  checkout).
- Mutation: `POST /api/subscriptions` (extended, additive body) →
  `{status:'PENDING', paymentUrl}`. On success, hard-navigate
  (`window.location.href`) to `paymentUrl` (external Bictorys hosted
  checkout) — same as today.
- Companion routes `/premium/success` / `/premium/failed` unchanged.

## Decisions (2026-08-28, confirmed with user)
- **Annual plan — DROPPED.** Re-confirms the Phase 0.3 decision. Only the
  2 500 FCFA/mois plan card is shown, no toggle, no "Populaire"/"−2 mois
  offerts" badges, no plan-selection state at all — one plan, one price.
- **Payment method (Wave / Orange Money / Free Money) — REAL.**
  `PaymentProvider.charge()` already accepts `metadata.paymentType`
  (mapped to `wave_money`/`orange_money`/`free_money` in
  `bictorys.ts`'s `mapMethodToBictorysType`) and `customer.phone` — never
  exposed in the UI before now. Selecting a method + entering a phone
  number is a genuine input to the real charge call, not decorative.
  `POST /api/subscriptions` body becomes
  `{ paymentMethod?: 'WAVE'|'ORANGE_MONEY'|'FREE_MONEY', phone?: string }`
  (both optional — omitting either falls back to today's behavior:
  `wave_money`, no customer phone).
- **Phone number field — fixed "+221" prefix**, not the general
  multi-country `PhoneField` (that component is for client/profile
  phones, which can be any country — Mobile Money operators here are
  Senegal-only). Same fixed-prefix pattern as `/login`/`/signup`'s phone
  input, composed to `+221XXXXXXXXX` and validated server-side with the
  existing `zPhone` helper (no new regex).
- **"Ce que tu obtiens" feature list — reuses the real `PREMIUM_FEATURES`**
  already defined in `/premium/page.tsx` (Clients illimités, Rappels
  WhatsApp, Alertes retard, Statistiques avancées, Export CSV & PDF).
  Extracted to a shared `lib/jurali/premium-features.ts` (or similar) so
  `/premium`, `/premium/checkout`, and `/premium/manage` never drift.
  Drops Banani's fabricated "Multi-appareils", "Sauvegarde cloud",
  "Support prioritaire" (no such systems exist).
- **Order summary "Récapitulatif" card** — real: plan (fixed "Premium
  Mensuel"), payment method label (from the form state), phone (from the
  form state), "Renouvellement" (today's date + 30 days, matching
  `SUBSCRIPTION_PERIOD_DAYS`), total (2 500 FCFA). No "Total aujourd'hui"
  vs. later distinction since there's no annual/proration.
- **Reassurance line** — kept ("Résiliation possible à tout moment.
  Aucun engagement à long terme.") since `/premium/manage`'s cancel is
  now real (see that plan).
- **Sidebar** — real `<DesktopSidebar>` component (not Banani's inline
  mock), matching the app-wide precedent (9 other pages). `/premium`
  itself stays sidebar-less (deliberate prior decision, not revisited).

## Component breakdown
- **REUSE** `DesktopSidebar` — same props as `/clients`/`/dashboard`.
- **REUSE** `PageTransition`, `Icon`, `formatPrice`, `tapScale`.
- **NEW** `lib/jurali/premium-features.ts` — shared `PREMIUM_FEATURES`
  constant (moved out of `/premium/page.tsx`).
- **NEW** `frontend/src/app/premium/checkout/page.tsx` — the whole screen
  (plan card is static, payment-method radio group + phone field are the
  only real form state).

## Token mapping (Banani → project)
Same `@theme` palette as the rest of the app (bg-background/primary/
accent/danger/etc. already match 1:1 — this is the same Jurali Banani
flow as every prior screen, no new token work needed).

## Responsive plan
- **Base (375px)**: single column, stacked: payment summary card first
  (so the total/CTA is visible without scrolling past the whole form —
  matches `/premium`'s existing mobile-first CTA placement), then plan
  card (single, no toggle), payment-method list, phone field. Full-width
  CTA button, ≥48px touch targets on the payment-method rows.
- **md (768px+)**: comfortable single-column max-width, larger paddings.
- **lg (1024px+)**: `DesktopSidebar` + Banani's 2-column body (left: plan
  fixed/payment method/phone stacked; right: sticky-ish summary card).

## Interactions / state
- Payment-method selection: radio-style rows (Wave pre-selected to match
  current default), tap anywhere on the row selects it.
- Phone field: required once a Mobile Money method needing it is picked;
  inline validation error (reuse the app's existing error-message style)
  if malformed on submit.
- Loading: "Redirection…" on the CTA while `POST` is in flight (matches
  `/premium`'s existing `submitting` pattern).
- Error: same `ERROR_MESSAGES` code→French mapping already in
  `/premium/page.tsx`, reused here.
- Already-Premium guard: if `GET /api/subscriptions` reports
  `isActive: true`, redirect to `/premium/manage` (this screen is
  Gratuit→Premium only).

## Copy / i18n
All French, inline in the page (matches existing `/premium/page.tsx`
convention — no separate i18n file in this project).

## Implementation checklist
- [ ] `lib/jurali/premium-features.ts` (extract from `/premium/page.tsx`)
- [ ] `frontend/src/app/premium/checkout/page.tsx`
- [ ] Extend `POST /api/subscriptions` body (paymentMethod/phone, both
      optional, validated) — thread into `provider.charge()`
- [ ] Update `/premium/page.tsx`: "Passer à Premium" → `Link` to
      `/premium/checkout`; already-active → redirect to `/premium/manage`
- [ ] 375 / 768 / 1024+ layout check
- [ ] Lint / typecheck / test / build
