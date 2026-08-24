# Page Premium — Banani → Next.js/Tailwind

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/PagePremium.jsx`
- Fetched: 2026-08-24 (Phase 7)
- `screenSize: 'desktop'` — sidebar + 2-column body. Built mobile-first.

## System context
- Route: `/premium` (new), auth-gated (`useUser()`).
- Data: `GET /api/subscriptions` → `{status, renewsAt, isActive, planAmountFcfa}`.
- Mutation: `POST /api/subscriptions` → `{status:'PENDING', paymentUrl}` (201)
  or replay (200) or `409 ALREADY_SUBSCRIBED` / `503`/`502` guard codes.
  On success, hard-navigate (`window.location.href`) to `paymentUrl` — an
  external Bictorys hosted checkout page, not an internal route.
- New companion routes: `/premium/success`, `/premium/failed` — the
  checkout's `successUrl`/`failureUrl` land here after Bictorys redirects
  back. Necessary for a complete loop (same reasoning as Phase 5's
  companion `/login`: without them the redirect is a dead end).

## Decisions (2026-08-24, applying the session's established precedents)
- **Annual plan + 14-day free trial** — DROPPED. Phase 0.3 already decided
  monthly-only V1; the `Subscription` model has no `TRIALING` status.
  Hero banner shows only "2 500 FCFA/mois", no annual line, no trial
  badge. CTA reads "Passer à Premium", not "Commencer l'essai gratuit".
- **Free-tier feature list** — Banani's 4 bullets include 2 that are
  factually false about the shipped product ("Historique 30 jours",
  "Export PDF basique" — there is no history truncation and no PDF
  export exists at all, free or paid). Replaced with the 3 things that
  are actually true today: up to 10 clients, suivi dettes/paiements,
  historique complet (no truncation).
- **Premium feature list (8 items)** — kept as Banani wrote it. This is
  descriptive/marketing copy on a pricing page (not an interactive
  control claiming to do something), and only one of the 8 is actually
  gate-enforced today (clients illimités, via Phase 7's
  `isSubscriptionActive` check in `POST /api/clients`). The rest are
  product roadmap, same as any pricing page listing near-term plans —
  no fake buttons/toggles were added for them.
- **Sidebar nav** — DROPPED, matching what Fiche client / Paramètres
  actually shipped (their plans mentioned an lg+ sidebar but the code
  uses a simple mobile-first header only — this page follows the same
  precedent for visual consistency, not Banani's per-screen sidebar).
  Also drops the sidebar's hardcoded "8/10 clients" upsell nudge (fake
  data, redundant on the page that already is the upsell).
- **Already-subscribed state** — if `GET` reports `isActive: true`, the
  page shows a confirmation card ("Tu es Premium · renouvellement le
  ...") instead of the checkout CTA, and the Premium pricing card's
  button reads "Plan actuel" (disabled) rather than staying clickable
  into a guaranteed 409.

## Implementation checklist
- [ ] `frontend/src/app/premium/page.tsx`
- [ ] `frontend/src/app/premium/success/page.tsx`
- [ ] `frontend/src/app/premium/failed/page.tsx`
- [ ] 375 / 1024+ layout check
- [ ] Wire GET/POST /api/subscriptions, error code mapping
- [ ] Lint / typecheck / build
