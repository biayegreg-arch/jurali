# Admin Console — Banani → Next.js (Jurali)

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/AdminDashboard.jsx` ("Jurali — Dashboard Admin", desktop)
- Fetched: 2026-08-29
- Only ONE screen was selected/designed in Banani. Its sidebar nav names the other 5 pages
  (Vue d'ensemble, Utilisateurs, Abonnements, Revenus, Notifications, Paramètres) but no
  mockups exist for them — those 5 are built fresh, styled consistently with the fetched
  screen's tokens/components, per the user's "toutes les pages nécessaires" instruction.

## System map (Step 0 answers)
- **Route tree**: `frontend/src/app/admin/*` does not exist yet — only `examples/frontend-pages/admin/{layout,users,withdrawals}.tsx` reference stubs (never imported, generic starter shape: Users/Orders/Withdrawals/Audit-log nav).
- **Backend already exists** (all `requireAdmin('ADMIN')` + `enforceAdminRateLimit`, PII-safe selects, cursor pagination): `GET /api/admin/users`, `GET/PATCH .../[id]`, `PATCH .../[id]/role`, `PATCH .../[id]/status`, `GET /api/admin/orders`, `GET /api/admin/withdrawals` + `POST .../[id]/cancel`, `GET /api/admin/audit-log`, `GET /api/admin/email-queue`, `GET /api/admin/outbox`, `GET /api/admin/rate-limits`, `GET /api/admin/me`.
- **Order/Withdrawal are dead weight for Jurali.** Grepped the whole app: no Jurali page ever creates an `Order` or a `Withdrawal` — both are generic starter/marketplace concepts (guest checkout, commission, payout). Jurali's actual product is debt-tracking (`Client`/`Transaction`) plus one real payment flow: the Premium `Subscription`. Banani's own nav (Utilisateurs / **Abonnements** / Revenus / Notifications / Paramètres) already reflects this — it has no "Orders" or "Withdrawals" tab. **Decision: adopt Banani's nav as-is, do not build Orders/Withdrawals admin pages** — building UI for models the product never populates would be the same kind of aspirational surface already rejected twice this project (fabricated premium features, Banani's annual plan).
- **Auth gate**: mirrors `examples/frontend-pages/admin/layout.tsx` — client-side `GET /api/admin/me` check + redirect; real enforcement is server-side `requireAdmin`/`requireSuperadmin` per route.
- **Data for pages that don't have a backend yet** (Abonnements list, Revenue aggregates, Dashboard KPIs): new endpoints, detailed below — every number must come from a real table, no fabricated placeholders (matches the `premium-manage` precedent of dropping invoice history because no ledger existed).
- **Nothing is Premium-gated here** — this is the operator's own back office, `requireAdmin`, unrelated to the shop owner's Premium subscription gate.

## The hard part: making the price editable, safely
- `PREMIUM_MONTHLY_PRICE_FCFA = 2500` is a hardcoded export in `lib/server/subscriptions/guards.ts`, read by `GET/POST /api/subscriptions`.
- Renewal is **never automatic** — Mobile Money has no auto-debit; `subscription-renewal-reminders` only emails a heads-up, the user must re-run `POST /api/subscriptions` themselves. So a price change is naturally scoped correctly already: `Subscription.planAmountFcfa` is snapshotted at checkout time and stays put until that row's *next* checkout — existing active subscribers are unaffected by an admin price change until they voluntarily renew.
- Plan: add a tiny singleton table, `PlatformConfig` (one row, fixed id), holding `premiumMonthlyPriceFcfa Int`. `GET/POST /api/subscriptions` reads it instead of the constant (constant becomes the seed/fallback default if no row exists yet — no migration-data step needed). New `GET/PATCH /api/admin/config` route: PATCH requires **SUPERADMIN** (financial mutation, same bar as role changes), validates `100 <= price <= 100000` FCFA, writes through `logAdminAction`, upserts the singleton row.
- This is intentionally a dedicated 1-column table, not a generic key-value settings store — nothing else needs to be admin-editable today (YAGNI).

## Pages to build

| Route | Banani source | Backend |
|---|---|---|
| `/admin` (Vue d'ensemble) | fetched `AdminDashboard.jsx` | **new** `GET /api/admin/overview` |
| `/admin/users` | styled fresh (Banani's table idiom) | existing `users`/`[id]`/`role`/`status` routes |
| `/admin/subscriptions` (Abonnements) | styled fresh | **new** `GET /api/admin/subscriptions` (list+filter) + **new** `GET/PATCH /api/admin/config` (price) |
| `/admin/revenue` (Revenus) | styled fresh | **new** `GET /api/admin/revenue` |
| `/admin/notifications` | styled fresh | existing `email-queue` + `outbox` routes (read-only, tabs) |
| `/admin/settings` (Paramètres) | styled fresh | existing `audit-log` + `rate-limits` routes |

Shared: `AdminLayout` (sidebar nav from the fetched screen, real `admin.role`/email footer via `/api/admin/me`, redirects non-admins to `/`).

### Real-data sourcing (no fabrication)
- **KPIs** (`/admin/overview`): total users (`count`), premium count (`count` where `isSubscriptionActive`), MRR (`premium count × current price`), conversion rate (`premium/total`). All real aggregates, computed server-side — no client-side guessing.
- **Revenue chart**: Banani mocks a fake "2023 vs 2024" bar comparison. There's no ledger giving that history for real. Real substitute: group **`WebhookLog`** rows (`provider: 'bictorys'`, `eventType: 'paid'`, correlated to a `Subscription.providerChargeId`) by month, sum `Subscription.planAmountFcfa` at time of each paid event — gives an honest single-series "actual monthly revenue" chart, sparse at first but real and will fill in.
- **"Paiements récents" / Revenue page detail list**: same `WebhookLog` join (paid/failed/refunded events → the `Subscription` → its `User`), not a fabricated list. This turns the previously-write-only `WebhookLog` table into the de facto payment ledger the admin needs — real data that already exists, just never surfaced.
- **"Nouveaux utilisateurs"**: existing `/api/admin/users` (newest first) plus, per row, a debt/amount summary — needs a small join to `Client`/`Transaction` per owner (count of clients + sum of outstanding balances), computed in the new `overview` endpoint.
- **Plan breakdown donut**: premium vs free counts — same aggregate as the KPI.

## Component reuse
- Icons: `Icon` component already exists in `components/jurali/`.
- No shared admin layout/table/card primitives exist yet — will extract `AdminSidebar`, `AdminTopbar`, `AdminKpiCard`, `AdminTable` (generic columns+rows) as this is built, since every one of the 6 pages reuses them (rule-of-three met immediately).
- Reuse project tokens already in `globals.css`/`@theme` — Banani's fetched palette (`--color-primary: #1E5C3A` forest green, `--color-accent: #E8A020` amber) — need to diff against Jurali's current live tokens before assuming they match; if they differ this is a new admin-only palette, confirm before treating it as "the" design system.

## Responsive plan
Banani only shipped desktop (`screenSize: 'desktop'`). Mobile-first is still mandatory:
- **Base (375px)**: sidebar collapses to a bottom tab bar or hamburger drawer (admin ops is desktop-first work in practice, but must not break on a phone) — single-column KPI cards, tables become stacked cards (same pattern already used for debtor lists on mobile).
- **lg (1024px+)**: Banani's fixed 260px sidebar + multi-column KPI grid, faithfully reproduced.

## Open questions for user — RESOLVED 2026-08-29
All three batched, all confirmed with the recommended default:
- Price editing: dedicated `PlatformConfig` singleton table, PATCH restricted to SUPERADMIN, audited, bounds-checked.
- Revenue data: build "Paiements récents" + the monthly chart from real `WebhookLog` events (see `lib/server/jurali/admin-revenue.ts`'s documented correlation limitation), not fabricated figures.
- Nav scope: follow Banani's nav exactly — no Orders/Withdrawals admin pages (unused models in Jurali).

## Implementation checklist
- [x] `PlatformConfig` model + migration; seed fallback = current constant
- [x] `GET/PATCH /api/admin/config` (SUPERADMIN, audited, bounds-checked)
- [x] Rewire `/api/subscriptions` GET+POST off the constant
- [x] `GET /api/admin/overview`, `GET /api/admin/subscriptions`, `GET /api/admin/revenue`
- [x] Backend commit: schema + guards + 4 new admin routes + `admin-revenue.ts` lib, 950 tests green
- [ ] `AdminLayout` + `AdminSidebar`/`AdminTopbar`/`AdminKpiCard`/`AdminTable` primitives
- [ ] `/admin` dashboard (pixel-match the fetched screen at 1280px)
- [ ] `/admin/users`, `/admin/subscriptions`, `/admin/revenue`, `/admin/notifications`, `/admin/settings`
- [ ] 375 / 768 / 1280 checks on every page
- [ ] lint + typecheck + test + build
- [ ] Per-page UI commits
