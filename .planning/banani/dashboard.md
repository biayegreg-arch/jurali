# Dashboard — Banani → Next.js/Tailwind v4

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/JuraliDashboard.jsx`
- Fetched: 2026-08-24 (first batch)

## Route
`frontend/src/app/page.tsx` (replaces the current default izikit welcome
page). Auth-gated via `useUser()` from `@/contexts/AuthContext` (redirects
to `/login` if logged out — `/login` doesn't exist yet, built in Phase 6;
until then this route is only reachable via a manually-established session,
see "Verification" below).

## Structure map
- Top bar (bg-primary): "Boutique" label + shop-owner name, bell icon
  (notifications — inert for V1, no notifications system), avatar
- Stats row: 2× `SummaryStat` — "Total dû" (accent) + "En retard"
- Search bar (static in Banani; wire to `?q=` on `/clients`, tapping it
  navigates to the Liste des débiteurs screen with focus in its search
  field — Dashboard itself doesn't filter its own "clients récents" list)
- Filter chips (Tous / En retard / Cette semaine / Ce mois) — Banani shows
  these on the Dashboard but they only make sense filtering the FULL list;
  tapping one navigates to `/clients?filter=X` rather than filtering the
  5 recent-client rows in place
- Section header "Débiteurs" + "Trier par montant" — links to `/clients`
- Debtor list: up to 5 `DebtorRow` (PRD 3.2 "5 derniers clients")
- Bottom CTA: "Nouvelle dette" (accent, primary) + a secondary icon button
  (Banani: bar-chart-2 → "Statistiques" nav, A.7 — no screen designed yet,
  renders disabled/inert)

## Component breakdown
- **NEW** `SummaryStat` (`src/components/jurali/SummaryStat.tsx`) — exact
  Banani source in `sharedFiles`, ported to TSX props
- **NEW** `DebtorRow` (`src/components/jurali/DebtorRow.tsx`) — same
- **NEW** `Icon` (`src/components/jurali/Icon.tsx`) — thin `lucide-react`
  wrapper matching Banani's `<Icon i="name" size={n} className="..." />`
  call signature
- **NEW** `QuickAction` — Banani gives it but current usage (a single
  "Nouvelle dette" button + one icon button) doesn't need the abstraction
  yet; inline the two buttons directly, revisit if a 3rd CTA shape appears
  (component-reusability rule: match the design's actual axes of
  variation, don't build for one call site)

## Token mapping
See roadmap A.6 — full `@theme` block goes in `frontend/src/app/globals.css`.
`bg-primary` / `text-primary-foreground` / `bg-accent` / `bg-surface` /
`border-border` / `text-danger` map directly to the CSS custom properties,
no Tailwind config file changes needed (Tailwind v4 `@theme` is CSS-native).

## Data
- `GET /api/dashboard` → `{ totalDueFcfa, debtorCount, overdueDueFcfa, overdueDebtorCount, recoveredThisMonthFcfa }`
- `GET /api/clients?sort=activity&order=desc&limit=5` → `{ items: ClientSummary[] }`
  for the "Débiteurs" row (Banani's `debtors` = 8 rows in the mock; PRD 3.2
  caps this section at 5 — cap wins over the mockup)

## Responsive plan
- **375px (base)**: exactly as Banani's mobile mockup — single column,
  full-width stat tiles side by side (2-col grid), full-width CTA buttons
- **md (768px+)**: stat row gets more breathing room (max-w container,
  centered), debtor rows unchanged
- **lg (1024px+)**: cap content width (`max-w-2xl mx-auto`) — Banani has no
  desktop dashboard variant *without* the month picker (that's Phase 9 /
  `DashboardDesktopWithMonthPicker`, deferred), so lg+ is this session's
  own layout call, not a Banani-sourced breakpoint

## Interactions / state
- Loading: skeleton stat tiles + 5 skeleton rows while both fetches are in flight
- Empty (0 clients): replace the debtor list with an empty-state card
  ("Aucun client pour l'instant — ajoute ton premier client en enregistrant
  une dette") — Banani never designed this state
- Error: inline retry banner, don't crash the page (both fetches independent)

## Copy / i18n
All labels are the French strings already in the Banani source — hardcode
them (PRD §8: no i18n system in V1, so no `constants.ts` indirection layer
needed beyond what's idiomatic for a single-language app).

## Implementation checklist
- [ ] `globals.css` `@theme` block
- [ ] `lucide-react` installed, `Icon.tsx`
- [ ] `SummaryStat.tsx`, `DebtorRow.tsx`
- [ ] `page.tsx` wired to `/api/dashboard` + `/api/clients`
- [ ] Loading/empty/error states
- [ ] 375 / 768 / 1024 check
- [ ] Verify against a manually-authenticated session (Phase 6 auth not built yet)

## Decisions (confirmed 2026-08-24)
- Client-row tap: inert for now (no navigation), reactivates once Phase 5
  builds `/clients/[id]`.
- Notifications bell + "Statistiques" icon button: render inert/disabled,
  no screens designed for either yet.
