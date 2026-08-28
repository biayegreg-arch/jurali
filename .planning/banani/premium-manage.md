# Gestion Premium — Banani → Next.js/Tailwind

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/GestionPremium.jsx`
- Fetched: 2026-08-28
- `screenSize: 'desktop'` — sidebar + 2-column body. Built mobile-first.

## System context
- Route: `/premium/manage` (new), auth-gated (`useUser()`), Premium-only
  (redirect to `/premium` if not active — this page has nothing to show
  a free user).
- `/premium` redirects here automatically when `GET /api/subscriptions`
  reports `isActive: true` (replaces today's inline "Tu es Premium"
  banner + full comparison for active users).
- Linked from Settings (new "Gérer mon abonnement" row, Premium-only,
  next to the existing Premium-gated toggles) — satisfies PRD §4's
  "annuler depuis les paramètres" via a real link, not a duplicated
  cancel control.
- Data: `GET /api/subscriptions` (extended, additive fields — see below).
- Mutation: `DELETE /api/subscriptions` (new) → immediate cancel.

## Decisions (2026-08-28, confirmed with user)
- **Annual plan / "Passer à l'annuel" card — DROPPED.** Same reasoning as
  the checkout screen.
- **Invoice history ("Historique de facturation") — DROPPED.** No
  per-cycle payment ledger exists (`Subscription` is one row reused
  across renewals); building one is a separate, larger feature. No
  download affordance either (nothing generates a PDF/receipt today).
- **"Total payé" / "Économie annuelle" stats — DROPPED** (same reason —
  fabricated without a real invoice ledger, and "Économie annuelle" only
  means something once an annual plan exists).
- **Cancel — REAL, immediate revocation.** New `DELETE /api/subscriptions`
  sets `status: 'CANCELED'` right away (the schema already reserves this
  status; `isSubscriptionActive` already treats any non-ACTIVE status as
  inactive regardless of `renewsAt`, so this is a one-line state change,
  not new gating logic). Confirmed via the existing `ConfirmDialog`
  (danger variant) — "Résilier maintenant" forfeits any remaining paid
  days; the dialog copy says so explicitly so it's not a surprise.
- **Payment method card — REAL but read-only, "Modifier" dropped.**
  New `Subscription.paymentMethod` / `Subscription.paymentPhone` columns,
  set in `POST /api/subscriptions` at checkout time (the method/phone the
  user picked on `/premium/checkout`) — reflects the last attempted
  checkout, same scoping as the existing `provider`/`paymentUrl` fields
  on this row. No "Modifier" button: there's no flow to change payment
  method for an already-active subscription (it only applies at the next
  checkout), so a button with no real destination is dropped rather than
  built fake.
- **"Actif depuis" — `Subscription.createdAt`.** Approximation: this is
  the first time this user ever subscribed, not necessarily the start of
  the *current* billing cycle if they lapsed and resubscribed later
  (Subscription is reused, not per-cycle). Documented here as a known
  simplification, not silently wrong.
- **"Clients gérés" stat — REAL**, from the same `totalClientCount`
  already computed by `GET /api/dashboard` (reused, not re-derived).
- **Fonctionnalités incluses — same shared `PREMIUM_FEATURES` constant**
  as the checkout screen (see `premium-checkout.md`). Drops "Multi-
  appareils", "Sauvegarde cloud", "Support prioritaire" for the same
  reason. "Historique illimité" is real (no truncation exists) — kept.
- **Sidebar** — real `<DesktopSidebar isPremium>` (nudge card naturally
  hides itself since the user IS Premium — no special-casing needed).

## Component breakdown
- **REUSE** `DesktopSidebar`, `PageTransition`, `Icon`, `ConfirmDialog`,
  `formatPrice`, `formatDateFr`, `useAsyncAction`.
- **REUSE** `lib/jurali/premium-features.ts` (from checkout plan).
- **NEW** `frontend/src/app/premium/manage/page.tsx`.

## Token mapping
Same palette, no new tokens.

## Responsive plan
- **Base (375px)**: stacked single column — current-plan card, payment
  method (read-only), features grid collapses to 1 column, cancel action
  as a full-width secondary/danger button at the bottom (not a small
  top-bar button — no room for a header action row at this width).
- **md (768px+)**: features grid 2 columns as Banani shows.
- **lg (1024px+)**: `DesktopSidebar` + Banani's 2-column body (left:
  plan/payment method fixed width; right: stats row + features).
  "Résilier l'abonnement" moves into the top bar (matches Banani) once
  there's room.

## Interactions / state
- Cancel: click → `ConfirmDialog` (danger) → `DELETE /api/subscriptions`
  → on success, redirect to `/premium` (no more Premium page to manage).
- Loading/empty states: skeleton-free simple "Chargement…" text (matches
  every other page's convention in this app — no shimmer components
  exist here).
- Error: toast via `useToast()` (matches the delete-client pattern from
  the debtor-list work) if cancel fails.

## Copy / i18n
French inline, same convention as the rest of the app.

## Implementation checklist
- [ ] `prisma/schema.prisma`: `Subscription.paymentMethod String?`,
      `Subscription.paymentPhone String?` + migration
- [ ] `POST /api/subscriptions`: persist `paymentMethod`/`paymentPhone`
- [ ] `GET /api/subscriptions`: return `paymentMethod`/`paymentPhone`/
      `createdAt`
- [ ] `DELETE /api/subscriptions` (new) — sets `status: 'CANCELED'`
- [ ] `frontend/src/app/premium/manage/page.tsx`
- [ ] `/premium/page.tsx`: redirect to `/premium/manage` when active
- [ ] Settings: "Gérer mon abonnement" link (Premium-only)
- [ ] 375 / 768 / 1024+ layout check
- [ ] Lint / typecheck / test / build
