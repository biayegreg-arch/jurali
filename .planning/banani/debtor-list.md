# Liste des débiteurs — Banani → Next.js/Tailwind v4

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/DashboardAll.jsx`
- Fetched: 2026-08-24 (first batch)

## Route
`frontend/src/app/clients/page.tsx`, auth-gated same as Dashboard.

## Structure map
- Same top bar + stats row as Dashboard (reused components, not rebuilt)
- Live search bar (Banani: static "Chercher un client..." placeholder →
  wire to a real controlled input, debounced, calling `/api/clients?q=`)
- Filter chips: Tous / Ce mois / Dernier mois / Il y a 2 mois / En retard —
  Banani's "Ce mois/Dernier mois/Il y a 2 mois" filter by month, which
  isn't a Phase 2 API capability (`/api/clients` has no month filter, only
  `q`/`sort`/`order`/`limit`). **En retard** maps directly to a client-side
  filter on the already-fetched `isOverdue` field. Recommendation: ship
  "Tous" + "En retard" now (both cheap, no backend change), skip the
  month chips for V1 (Phase 9 territory — same family as the month-picker
  screens deferred in the original roadmap A.1)
- Section header with live result count ("N résultats")
- Full `DebtorRow` list, no cap (unlike Dashboard's 5)
- Bottom CTA: "Nouvelle dette" (same as Dashboard)

## Component breakdown
- **REUSE** `SummaryStat`, `DebtorRow`, `Icon` from the Dashboard build
- **NEW** `SearchInput` if a 3rd search field appears elsewhere later;
  for now the raw input lives inline (rule of three not yet hit)

## Data
- `GET /api/clients?q=<debounced>&sort=amount&order=desc` (PRD 3.5: "Tri
  possible par montant dû (décroissant) ou par ancienneté" — default to
  amount-desc, add a sort toggle wired to `?sort=activity`)
- Client-side filter for the "En retard" chip: `items.filter(i => i.isOverdue)`

## Responsive plan
- **375px**: identical to Banani's mobile mockup
- **md/lg**: same container-width treatment as Dashboard; `DashboardAllDesktop`
  (second Banani batch) adds a month-picker sidebar + table layout that's
  out of scope here (Phase 9) — lg+ here just widens the existing card list,
  doesn't switch to the desktop table structure

## Interactions / state
- Empty search results: "Aucun client ne correspond à « {q} »"
- Empty client list (0 clients ever): same empty state as Dashboard
- Tapping a `DebtorRow` → see the batched question (fiche client not built
  yet, Phase 5)

## Copy / i18n
French strings hardcoded, same as Dashboard.

## Implementation checklist
- [ ] `page.tsx` with debounced search + sort toggle + "En retard" filter
- [ ] Empty/loading/error states
- [ ] 375 / 768 / 1024 check

## Decisions (confirmed 2026-08-24)
- Month filter chips: deferred to Phase 9.
- Client-row tap: inert for now (see dashboard.md).

## Audit fix (2026-08-25)
Same container-width gap as Dashboard ("same container-width treatment as
Dashboard" above was never actually built — zero `max-w` shipped). Fixed
identically: content now wraps in `max-w-2xl mx-auto`, matching `TopBar`'s
own fix. See `dashboard.md`'s "Audit fix" note for the full list (this
page shares `TopBar`, so the `displayName` rename and the bell/avatar
fixes apply here too).

## Desktop sidebar + table (2026-08-25)

User selected Banani's `DashboardDesktopWithMonthPicker.jsx` ("Jurali —
Dashboard Desktop") and asked to implement it. Read at the source (sidebar
nav + KPI tiles, full-width debtor table with search/filters/month
scoping) it is really the deferred `DashboardAllDesktop` reference from
this file's own "Month filter chips: deferred to Phase 9" note above, not
a redesign of `/dashboard` (which shows a KPI hero + a 5-item preview, not
a full searchable table). Confirmed via 4 batched AskUserQuestion before
coding:

1. **Target route: `/clients`**, not `/dashboard` — the design shows ALL
   debtors in a searchable/filterable table, which is this page's job.
   `/dashboard` is untouched.
2. **Sidebar scoped to `/clients` only** — not a global desktop app shell.
   Settings, Fiche client, Nouvelle dette, etc. keep their current layout.
3. **"Statistiques" nav item dropped** — no such page exists anywhere in
   the app (confirmed, out of PRD scope), and this session's standing rule
   is no dead links in shipped UI (same bar as the 2026-08-24 audit).
4. **Month-picker reuses the existing `MonthPicker` component** (prev/next
   arrows, already built for `/dashboard` in the prior Month-picker pass)
   instead of reproducing Banani's dropdown-trigger pixel, for UX
   consistency across breakpoints and zero new component surface.

### `?month=` semantics on `/api/clients` (technical decision, not asked)
Extended `GET /api/clients` (TDD, 4 new tests) with an optional
`?month=YYYY-MM`, reusing `parseMonthParam`/`monthBounds` from
`month-range.ts` (already shared/client-safe, no `'server-only'` marker).
Deliberately **different default from `/api/dashboard`'s own `?month=`**:
absent here means *no filter* (today's full list, unchanged) — a debtor
list must never silently hide someone's older unpaid debt just because no
month was picked. Only a *present* value restricts the list to clients
with ≥1 transaction (DEBT or PAYMENT) inside that month's `[start, end)`
window (`transactions: { some: { createdAt: {...} } }`, ANDed with the
existing `?q=` search when both are present). A malformed-but-present
value still falls back to the current month, matching `parseMonthParam`'s
existing contract. Balance/`isOverdue`/`lastActivityAt` stay computed from
each client's **full** transaction history regardless — only which
clients appear in the list is month-scoped, never the numbers shown for
them (same "stats scoped, live balance never scoped" precedent as the
Dashboard month-picker).

### UI
- **New** `components/jurali/DesktopSidebar.tsx` — 280px `bg-primary`
  panel: shop identity (links to `/settings`), nav (Débiteurs/En
  retard/Paramètres — no Statistiques), 2 KPI tiles, "Nouvelle dette" CTA.
  Diverged from Banani's `SummaryStat` reuse: its `accent=true` variant is
  `bg-primary`, which is invisible against this sidebar's own `bg-primary`
  background (a contrast bug in the source, not a product decision) — used
  the same semi-transparent-white tile treatment already established for
  the stat card on `/signup`'s dark brand panel instead.
- **New** `components/jurali/DebtorTableRow.tsx` — desktop table row
  (Client/Produit/Montant/Ancienneté/Statut), reuses `DebtorRowProps` so
  the amount/daysAgo/lastItem derivation isn't duplicated between the
  mobile card and the desktop row.
- **New interaction**: a 3rd row of controls appears at `lg:` only — search
  (existing), then `Tous`/`Ce mois` as a mutually-exclusive time-scope
  pair (mirrors the design's visual grouping) with `MonthPicker` appearing
  next to `Ce mois` when active, then `En retard` as an independent,
  combinable severity filter (same `overdueOnly` state the mobile chips
  already drive — the sidebar's own "En retard" nav item toggles the same
  state, so all three controls stay in sync for free).
- Dropped Banani's static "Janvier 2024" subtitle in the content header —
  redundant with the month chip once `Ce mois` is engaged, adds noise
  without adding information. Also skipped reproducing a sort-toggle
  control in the desktop header (mobile's `trier par` link stays
  mobile-only) to keep the desktop build tight to what was asked.
- `lg:`-gated via `hidden lg:flex` / `lg:hidden` pairs, exactly the
  pattern already used on `/signup`'s brand panel — the mobile card-list
  layout is byte-for-byte unchanged below `lg:`.
- **Bonus fix** (adjacent, obviously correct, not asked): `DebtorRow` was
  never wrapped in a link to `/clients/[id]` anywhere in the app — this
  file's own "Client-row tap: inert for now... reactivates once Phase 5
  builds `/clients/[id]`" note was simply never followed up once Phase 5
  shipped. Fixed now on both `DebtorRow` (mobile card) and the new
  `DebtorTableRow`, since building the desktop row touches this exact code
  path anyway. `DebtorRowProps` gained an `id` field;
  `toDebtorRowProps()` now populates it.
- `TopBar`'s previously-private `NotificationBell` sub-component exported
  and reused for the desktop content header's bell icon (Banani shows an
  inert bell there; wired to the real `/api/notifications/count` +
  `/notifications` link instead, matching the mobile TopBar's already-real
  bell).

### Testing
- `api/clients/route.test.ts`: +4 tests (15 total) — no-filter unchanged,
  month-scoped where-clause, month+search combined, malformed-month
  fallback.
- Full suite: 731 tests, 730 passed (1 pre-existing bcrypt-timeout flake
  in `signup/route.test.ts`, unrelated, same as every prior phase).

### Verification
`typecheck`/`lint`/`format`/`build` all clean. Live end-to-end against the
dev DB: phone-signup → 2 clients, one with a transaction this month, one
with none → `GET /api/clients` (no filter) returns both, `?month=<this
month>` returns only the active one, `?month=2026-01` (no activity)
returns zero, `?month=<this month>&q=fat` combines correctly. Test data
cleaned up, dev server stopped. **Not verified**: the actual rendered
sidebar/table at `lg:`/`1280px` in a browser, and the `Tous`/`Ce
mois`/`En retard` click interactions — this page is `'use client'` with
no server-fetched data in its initial render (`useUser()` returns null
pre-hydration), so curling it returns an empty shell exactly like every
other authenticated page this session; no browser-automation tool is
available here. Typecheck/build passing rules out compile-time JSX
errors, not visual/interaction correctness.

### Implementation checklist
- [x] `GET /api/clients` `?month=` (TDD, 4 tests)
- [x] `DesktopSidebar.tsx`
- [x] `DebtorTableRow.tsx`
- [x] `Tous`/`Ce mois`+`MonthPicker`/`En retard` desktop filter row
- [x] `DebtorRow` + `DebtorTableRow` link to `/clients/[id]` (bonus fix)
- [x] `NotificationBell` exported and reused
- [x] typecheck/lint/format/build clean
- [x] Backend verified end-to-end against dev DB (4 scenarios)
- [ ] Rendered lg+ layout + click interactions — NOT verified, no browser
      automation available

## Audit fix (2026-08-25) — duplicate notification-count fetch

Self-review before committing the desktop sidebar + table work above (same
"audit before commit" bar as the 2026-08-24 full-app audit). Found: the
new desktop content bar renders its own `<NotificationBell />` alongside
the mobile `TopBar`'s own bell. Tailwind's `hidden`/`lg:hidden` split is
CSS-only — both trees are always **mounted** regardless of viewport, and
`useApi`'s module-level cache only dedupes *sequential* calls (cache-hit
on the 2nd mount), not two instances racing on the same empty cache on
first load. Net effect: every `/clients` page load fired `GET
/api/notifications/count` twice.

Fixed by hoisting a single `useApi('/api/notifications/count')` call in
`ClientsPageContent` and threading the resolved count down as an optional
prop: `TopBarProps` gained `notificationCount?: number`, `NotificationBell`
gained a matching `count?: number | undefined` override that skips its
own fetch when provided (`skip: countOverride !== undefined`). Omitting
the prop entirely preserves the exact self-fetching behaviour `/dashboard`
already relies on — zero ripple to that page. `count?: number | undefined`
(not just `count?: number`) is required for
`exactOptionalPropertyTypes` — passing an optional prop whose value may
literally be `undefined` needs the explicit union, caught by `tsc` during
this fix.

Re-verified after the fix: typecheck/lint/format/build clean, full suite
731 tests (730 pass, same 1 pre-existing unrelated flake).
