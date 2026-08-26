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

## Audit fix (2026-08-24) — closes 2 gaps found during a full app audit
- The `md`/`lg` container-width treatment promised above ("md: max-w
  container, centered" / "lg: cap content width max-w-2xl mx-auto") was
  never actually implemented — the page shipped with zero breakpoint
  classes and zero `max-w`. On a desktop viewport, `TopBar`'s stat tiles
  and every `DebtorRow` stretched full-bleed edge to edge. Fixed: `TopBar`
  now wraps its own content in `max-w-2xl mx-auto`, and this page wraps
  everything below it the same way.
- Notifications bell is no longer inert (Phase 9 wired it for real). The
  identity avatar circle — a decision this file never explicitly covered
  — turned out to have no `onClick`/`href` either, meaning `/settings`
  was unreachable from anywhere in the authenticated app. Now links there.
- `TopBar`'s `email` prop displayed the phone-signup synthetic email
  (`<phone>@phone.jurali.local`) verbatim instead of the shop name —
  renamed to `displayName`, now passed `user.shopName || user.email`.

## Desktop sidebar + table (2026-08-25) — moved here from `/clients` per user override

The desktop sidebar+table treatment (Banani's `DashboardDesktopWithMonthPicker.jsx`,
see `.planning/banani/debtor-list.md` § Desktop sidebar + table for the full
component/backend writeup) was originally scoped to `/clients` only —
confirmed via AskUserQuestion ("l'écran montre TOUS les débiteurs dans un
tableau... c'est le rôle de /clients, pas de /dashboard"). After shipping
that, the user looked at `/dashboard` itself, didn't see it there, and
after a second round of clarifying questions explicitly confirmed (twice)
that they want this exact look on `/dashboard` specifically — "pas
/clients". Rather than moving it (which would have deleted a shipped,
tested page), it's now mounted on **both** routes:

- **New** `lib/useDebtorListState.ts` — extracted the search/sort/
  overdue/month-filter state + the `/api/clients` fetch out of
  `clients/page.tsx` into a shared hook, once a second page needed the
  identical state machine. Returns `sort`/`setSort` even though this
  page's desktop table has no sort control (mirrors `/clients`, which
  still exposes it on mobile) — harmless, just unused here.
- **New** `components/jurali/DesktopDebtorWorkspace.tsx` — extracted the
  title bar + search/filter row + table JSX out of `clients/page.tsx` for
  the same reason. `DesktopSidebar` was already a standalone,
  props-driven component, so it needed no changes to be reused as-is.
- `dashboard/page.tsx`: added `<DesktopSidebar>` + `<DesktopDebtorWorkspace>`
  at `lg:`, wired to the new hook (aliased `debtor*` in this file to avoid
  colliding with the page's own pre-existing `historyMonth`/`setHistoryMonth`
  state, which scopes the unrelated "Historique mensuel" KPI cards — two
  independently-scoped "month" concepts now coexist on this page). The
  existing mobile KPI-hero + 5-client-preview + month-picker-card layout
  is completely unchanged below `lg:`.
- `clients/page.tsx` refactored to consume the same 2 extracted pieces —
  net effect is identical behavior to before, just de-duplicated.
- Same hoisted-`notificationCount` pattern as the `debtor-list.md` audit
  fix applied here too (the mobile bell + the new desktop workspace's
  bell both mount simultaneously on `/dashboard` now — would have
  reintroduced the exact duplicate-fetch bug just fixed on `/clients` if
  left self-fetching).

### Verification
`typecheck`/`lint`/`format`/`build` clean. Full suite: 731 tests, 730
passed (1 pre-existing unrelated flake). Live re-check against the dev DB
(signup → client + debt → `/api/dashboard`, `/api/clients`,
`/api/notifications/count` all correct) — the backend contracts didn't
change in this pass, only frontend component structure, so this mainly
confirms no regression. **Not verified**: the actual rendered `/dashboard`
at `lg:`/1280px in a browser — same standing limitation, no browser
automation available here.

## Component-completeness fix (2026-08-25) — 3 elements missing vs. the Banani capture

User sent the same Banani screenshot a third time, this time saying "avec
toutes les composantes qui se trouvent dans la capture" — a direct
instruction to reconcile every visible element, not just the structural
layout. Diffed the capture against the shipped `DesktopSidebar` /
`DesktopDebtorWorkspace` and found 3 real gaps (fixed without asking
further — each has one clearly-correct, non-fabricated resolution):

1. **Sidebar identity block** only showed an avatar linking to
   `/settings`, dropping the name + "Propriétaire" role line the capture
   shows under the (illustrative, Banani-mock) avatar photo. Fixed with
   **real** data, not a fabricated photo: `GET /api/auth/me` extended to
   return `User.name` (TDD, 1 new test) — phone-signup always collects
   it, Google OAuth already sets it from the ID token, so this is
   populated for effectively every account, not a placeholder.
   `AuthContext`'s `User` interface gained `name: string | null`.
   `DesktopSidebar` gained a `fullName` prop; first name derived via
   `fullName?.trim().split(/\s+/)[0] || displayName`, falling back to
   the existing shopName/email display name when null. "Propriétaire" is
   hardcoded — every Jurali account is a single-owner shop (no
   multi-tenancy), so it's always structurally true, not a fabricated
   label.
2. **"Statistiques" nav item** — previously removed entirely (no `/stats`
   page exists). Restored as **visibly present but inert**
   (`opacity-40 cursor-not-allowed`, `aria-disabled`, no `onClick`/`href`)
   rather than either a dead link or an omission — this is the exact same
   treatment this codebase already gave the identical "Statistiques"
   placeholder on the mobile Dashboard back in Phase 4
   ("Notifications bell + 'Statistiques' icon button: render
   inert/disabled, no screens designed for either yet" — see the
   "Decisions (confirmed 2026-08-24)" section above). Not a new pattern,
   just applied consistently to the new sidebar.
3. **Month subtitle** under "Tous les débiteurs" — Banani hardcodes
   "Janvier 2024" always; `DesktopDebtorWorkspace` now shows the real
   selected-month label but **only when `monthActive`** — showing a date
   while "Tous" (all-time) is selected would misrepresent the list as
   month-scoped when it isn't.

### Verification
TDD for the `name` field (RED confirmed, then GREEN).
`typecheck`/`lint`/`format`/`build` clean. Full suite: 732 tests, 731
passed (same 1 pre-existing unrelated flake). Live re-check against the
dev DB: phone-signup with `name: "Mamadou Diallo"` → `GET /api/auth/me`
correctly returns `"name":"Mamadou Diallo"` end-to-end. Test data cleaned
up, dev server stopped. **Not verified**: the actual rendered sidebar/nav
at `lg:` in a browser (inert-item styling, name truncation, etc.) — same
standing limitation.
