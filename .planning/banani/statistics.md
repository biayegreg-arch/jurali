# Statistiques — Banani → Next.js/Tailwind v4

## Source
- Banani screen ID: `StatisticsDesktop.jsx` ("Jurali — Statistiques (Desktop)")
- Fetched: 2026-08-26

## Route
`frontend/src/app/stats/page.tsx`, auth-gated + **Premium-gated**
(`/premium` already advertises "Statistiques avancées" as Premium-exclusive
— confirmed via AskUserQuestion rather than assumed). A free-tier user
never triggers `GET /api/stats` at all: the page fetches
`/api/subscriptions` first and only calls `/api/stats` when
`isActive === true`.

## Backend
`GET /api/stats` (new route), gated exactly like
`POST /api/clients/[id]/remind` — `isSubscriptionActive()` from
`lib/server/subscriptions/guards.ts`, 403 `PREMIUM_REQUIRED` otherwise.
Pure helpers in `lib/server/jurali/stats.ts` (TDD, 8 unit tests):
- `computeRecoveryRatePercent(totalPaidFcfa, totalDueFcfa)` — confirmed
  formula: `totalPaid / (totalPaid + totalDueFcfa)`, rounded to 1 decimal,
  `0` when both are `0`.
- `bucketMonthlyTrend(transactions, months)` — buckets a flat transaction
  list into ordered calendar-month totals (`newDebtsFcfa`/`recoveredFcfa`).

Route response: `totalDueFcfa`/`debtorCount`/`overdueDueFcfa`/
`overdueDebtorCount` (via `listClientSummaries`, same as `/api/dashboard`
and `/api/clients` — can't drift), `averageDebtFcfa` (`totalDueFcfa /
debtorCount`, rounded, `0` with no debtors), `totalPaidFcfa` (lifetime
`PAYMENT` sum — deliberately unbounded, unlike `/api/dashboard`'s
calendar-month `recoveredThisMonthFcfa`, because the recovery rate answers
"of everything ever owed, how much has been recovered", not a monthly
snapshot), `recoveryRatePercent`, `monthlyTrend` (oldest-first, current
month last, via one `findMany` over the 6-month window).

## Structure map
- Top bar: "Statistiques" title + current month/year subtitle (Banani's own
  subtitle, "Janvier 2024", is hardcoded mock data — replaced with the real
  current month since the KPIs below aren't actually month-scoped; kept as
  an "as of" reference, not a filter).
- 3-card KPI grid: Total dû / En retard (danger tone) / Taux de
  recouvrement (primary tone, sub = "Moyenne {averageDebtFcfa}").
- 6-month bar chart: two bars per month (`newDebtsFcfa` = secondary color,
  `recoveredFcfa` = primary color), height = `value / max * 100%`.
  **Deviation from the Banani source**: Banani computes `max` over
  `amount` (debt) only — a month where `recoveredFcfa > newDebtsFcfa` (very
  plausible: paying off an old debt) would overflow the container. Fixed
  by taking `max` over both series combined.

## Component breakdown
- **NEW** `StatCard` (`components/jurali/StatCard.tsx`) — the 3-card KPI
  tile (icon badge + big number + tone). Not merged into `SummaryStat`
  (sidebar tiles): different size, icon badge, and a danger tone that
  `SummaryStat` has no axis for.
- **REUSE** `DesktopSidebar`, `NotificationBell` (from `TopBar.tsx`),
  `TopBar` (mobile).

## Responsive plan (Banani gave desktop only)
- **375px**: `TopBar` (shop identity + KPI hero, same component as
  `/dashboard`/`/clients`), then a stacked "Statistiques" section: 3
  `StatCard`s full-width, then the chart (smaller bar heights, horizontal
  scroll if 6 months don't fit). Free-tier: a centered upsell card instead.
- **lg (1024px+)**: `DesktopSidebar` + the Banani layout as designed
  (3-column KPI grid, full-width chart).

## Gating decision (confirmed 2026-08-26)
Premium-gated end to end (frontend upsell card + backend 403), matching
`/premium`'s existing marketing copy rather than inventing new gating
logic or leaving it free.

## Mobile reachability
`DesktopSidebar`'s "Statistiques" nav item is `lg:`-only (the sidebar
itself is `hidden lg:flex`), so mobile had no path to `/stats` at all.
Added a "Statistiques" row under a new "Analyse" section on `/settings`
(reachable from every device) linking to `/stats` — the page itself
decides real content vs. upsell, so this link needs no premium branching
of its own.

## Implementation checklist
- [x] `lib/server/jurali/stats.ts` + tests (TDD)
- [x] `GET /api/stats` route + tests (TDD, premium-gated)
- [x] `StatCard.tsx`
- [x] `app/stats/page.tsx` (mobile + desktop)
- [x] `/settings` "Analyse" section (mobile reachability)
- [ ] 375 / 768 / 1024 dev-server check
- [ ] Live functional verification against real DB
