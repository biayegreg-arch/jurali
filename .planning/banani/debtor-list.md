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
