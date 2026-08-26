# Dettes en retard — Banani → Next.js/Tailwind v4

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/DettesEnRetardDesktop.jsx`
- Fetched: 2026-08-26, alongside a `FicheClient.jsx` re-fetch (see `fiche-client.md`'s 2026-08-26 update #2)
- `screenSize: 'desktop'` — sidebar layout, same shell as every other desktop screen. Built mobile-first per skill rule; no mobile mock was provided.

## System context
Brand-new screen — nothing like it existed. The closest prior art is the dashboard's mobile "En retard" filter CHIP (`dashboard/page.tsx`, links to `/clients?filter=overdue`), which stays untouched: it's a same-page quick filter over the CLIENT-level list, conceptually different from this new page's PER-DEBT breakdown. Only `DesktopSidebar`'s "En retard" NAV item (a distinct sidebar destination, present on every desktop page) was repointed here.

## Structure map
- Sidebar (shared `DesktopSidebar`) — "En retard" nav item now links here and gets active-state highlighting (previously pointed at `/clients?filter=overdue` with no highlight at all).
- Top bar: back button, title, subtitle (`N clients avec paiements en retard`), Exporter button, notification bell.
- 3 summary stat cards: Total en retard (danger tone), Jours en retard (moy), Clients affectés.
- Debt table (desktop) / card list (mobile): one row per OVERDUE DEBT, not per client — Date, Client (avatar+name+phone), Articles, Montant, Retard (days badge), per-row "Envoyer" reminder button.
- Bottom: bulk "Marquer comme payés" button.

## Component breakdown
- **NEW** `frontend/src/app/api/debts/overdue/route.ts` — flattens every client's overdue debts (via new `listOverdueDebts`) into one row per debt, sorted by days-overdue descending.
- **NEW** `listOverdueDebts` in `balance.ts` — itemized sibling of `computeOverdueBalance` (same FIFO logic, returns rows instead of a sum). Deliberately not refactored to share code with `computeOverdueBalance` — see the code comment.
- **NEW** `frontend/src/app/debts/overdue/page.tsx` — mobile card list + desktop table, both sharing one `useApi('/api/debts/overdue')` fetch.
- **NEW** `useExportDebtsCsv` hook (`lib/useExportDebtsCsv.ts`) — extracted from Settings' "Exporter toutes les dettes" so both screens share the export logic (different visual treatment per screen, same underlying `GET /api/clients/export` + `downloadDebtsCsv` call).
- **REUSE** `DesktopSidebar`, `NotificationBell`, `Icon`, `formatPrice`, `formatDateFr`.

## Decisions (batched AskUserQuestion, confirmed 2026-08-26, all "Recommandé")

- **Route**: new dedicated `/debts/overdue` page (per-debt granularity), not a reuse of the client-level `/clients?filter=overdue` filter.
- **"Envoyer rappels WhatsApp" (bulk)** — DROPPED. `POST /api/clients/[id]/remind` only returns a `wa.me` URL the browser opens — one conversation at a time, manual tap-to-send inside WhatsApp. There is no WhatsApp Business API integration, so a true one-click bulk-send is not technically possible. Replaced with a single per-row "Envoyer" button (table: compact icon button; mobile: labeled button) — reuses the exact same reminder endpoint as the fiche client page.
- **"Marquer comme payés" (bulk)** — built for real. Aggregates the currently-listed overdue rows per client (client-side `Map<clientId, totalOverdueFcfa>`), then fires one `POST /api/transactions {type:'PAYMENT'}` per affected client in parallel (`Promise.allSettled`, reports a toast if any fail). Same real quantity type as the existing single-client `MarkOverdueAsPaidButton` on the fiche page — no new backend.
- **"Exporter"** — reuses the existing global `GET /api/clients/export` (Premium-gated, same upsell-if-not-premium pattern as Settings), not a new overdue-scoped export endpoint.
- **Premium gating** — the PAGE itself is free-tier accessible (same tier as the base `/clients` list — seeing which debts are overdue is core functionality, not a Premium differentiator, unlike `/stats`'s whole-page gate). Only the per-row "Envoyer" reminder and the "Exporter" button carry their own pre-existing Premium gates.
- **Sort order** — most overdue (highest days-overdue) first. Banani's own 3-row mock example happened to be ordered by debt date, not urgency; sorted by actual urgency instead since that's more useful for deciding who to chase first (documented judgment call, not asked — consistent with the session's established bar for low-ambiguity UX calls).

## Responsive plan
- **375px (base)**: single column — stacked 2×2 stat tile grid, then a card per overdue debt (avatar+name+note+date, days-overdue badge, amount, per-row "Envoyer" button), then the bulk "Marquer comme payés" + "Exporter" buttons stacked full-width at the bottom.
- **lg (1024px+)**: reproduces Banani's sidebar + 3-card grid + table layout exactly, including the hover-highlighted table rows and compact icon-only per-row action button.

## Empty/loading/error states
- Loading: "Chargement…" text (matches every other page's pattern).
- Empty (`items.length === 0`): "Aucune dette en retard — bravo !" — a positive empty state, not a bare "no results" message, since this list emptying out is the desired outcome.
- Per-row reminder send failure: silent no-op (the fiche page's own `ReminderCard` already owns the canonical error-message UI for this endpoint's failure modes; duplicating that messaging in a dense table row would be noisy).
- Bulk mark-paid partial failure: toast reporting how many of N payments failed, then refetches so the list reflects whatever DID succeed.

## Implementation checklist
- [x] `listOverdueDebts` in `balance.ts` + tests
- [x] `GET /api/debts/overdue` + tests
- [x] `useExportDebtsCsv` hook (shared with Settings)
- [x] `frontend/src/app/debts/overdue/page.tsx` (mobile + desktop)
- [x] `DesktopSidebar`'s "En retard" link repointed + active-state added
- [x] 375 / 1024+ layout check (Turbopack hot-reload, both breakpoints rendered)
- [x] Lint / typecheck / build
- [x] Live verification: real FIFO overdue rows, sort order, partial payment reflected as reduced remaining, bulk mark-paid settles exactly the listed amounts, list empties out afterward
