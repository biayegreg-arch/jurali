# Fiche client — Banani → Next.js/Tailwind

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/FicheClient.jsx`
- Fetched: 2026-08-24 (Phase 5, second fetch after debtor-list-only reselection)
- `screenSize: 'desktop'` — sidebar layout. Built mobile-first per skill rule; sidebar collapses to a mobile header below `lg:`.

## Structure map
- Sidebar (desktop only, `lg:` and up): shop identity, nav (Débiteurs/En retard/Statistiques/Paramètres — only "Débiteurs" and "Paramètres" route anywhere real today), 2 `SummaryStat` tiles, "Nouvelle dette" CTA.
- Mobile header (`<lg:`): back button + title, matching Phase 4's page header pattern.
- Identity card: avatar-less initials circle (no `UserAvatar` dependency — Phase 4 didn't pull that shared component, keep consistent), name, "Cliente depuis <mois>", phone, "Modifier"/"WhatsApp" buttons.
- 4 stat tiles: Total dû, Total payé, Nb dettes, En retard.
- "Prochain rappel" card.
- Debt history table/list with per-row Statut chip (Payée/En retard).
- Bottom actions: "Marquer les dettes en retard comme payées", "Exporter PDF".

## Component breakdown
- **REUSE** `Icon`, `TopBar`-style header pattern (adapted, not the literal component — this screen has a back button + title, not the dashboard's stat-tile header)
- **NEW** `DebtHistoryRow` — one row of the history list (mobile-first stacked card, not the desktop grid table)
- **REUSE** `computeClientBalance`, `isOverdue` from `lib/server/jurali/balance.ts`
- **NEW** `computeDebtStatuses` in `balance.ts` — per-DEBT-transaction FIFO status (`PAID` / `UNPAID` / `OVERDUE`), pure + unit tested, no schema change (roadmap A.7 already flagged this as a display derivation, not new state)

## Token mapping
Identical `@theme` tokens already ported in Phase 4 (`globals.css`) — no new tokens needed.

## Responsive plan
- **375px (base)**: single column. Header: back + "Fiche client" title. Identity card full width. 4 stat tiles as a 2×2 grid. Reminder card full width. Debt history as stacked cards (date/items/amount/statut), not a grid table (the Banani desktop grid with 5 fixed-px columns doesn't fit 375px). Bottom actions stack vertically full-width.
- **md (768px)**: stat tiles could go 4-across; debt history stays stacked cards (grid table still cramped at tablet width for the item/note text column).
- **lg (1024px+)**: reproduces Banani's sidebar layout — fixed 280px sidebar + main content with the identity/stats column (320px) and the debt history table (grid, matches Banani's `gridTemplateColumns`).

## Interactions / state
- Loading: skeleton-less "Chargement…" text (matches Phase 4 pattern).
- Empty history: "Aucune dette enregistrée pour ce client."
- Error (404 CLIENT_NOT_FOUND — wrong id or not owner): render a "Client introuvable" state with a link back to `/clients`.
- "Ajouter dette" → `router.push('/debts/new?clientId=' + id)` (route already accepts this param, built Phase 4).

## Copy
All French, inline (matches Phase 4 — no i18n layer exists in this project; Banani's `t()` wrapper is a no-op we don't reproduce).

## Decisions (2026-08-24, applying the session's established "don't build fake UI" precedent — no separate AskUserQuestion round, consistent with every prior confirmed decision this session)
- **"Marquer les dettes en retard comme payées"** — OMITTED. No clean backend mapping (would conflate "payer une dette précise" with the existing single-amount `POST /api/transactions PAYMENT` flow); the real "Paiement reçu" flow (Phase 4, `/payments/new`) is the correct entry point for recording a payment. Left out of this screen entirely rather than wired to something semantically confusing.
- **"Exporter PDF"** — OMITTED, Phase 9 backlog (already documented in roadmap A.3).
- **"Envoyer WhatsApp" / "Envoyer maintenant" (reminder card)** — rendered but visually disabled (`opacity-50 cursor-not-allowed`, no onClick), Phase 8 not built yet. The "Prochain rappel" auto-schedule line is dropped (no real schedule exists) — replaced with a static "Rappel manuel — disponible bientôt" line.
- **Per-debt Statut (Payée/En retard)** — BUILT for real via `computeDebtStatuses` (FIFO derivation over existing transaction data, no schema change) — this is genuine, useful data, not a Banani-only embellishment, and the roadmap already pre-approved this exact approach (A.7).
- **"Modifier" (edit client identity)** — OMITTED, no `PATCH /api/clients/[id]` endpoint exists. Not built this phase (would be new backend surface, out of the "Fiche client + Paramètres, no new backend" scope the user picked).
- **`UserAvatar` (Banani shared component)** — not pulled in; Phase 4 already established initials-circle avatars (`DebtorRow` pattern) as the project's actual avatar treatment — kept consistent instead of introducing a second avatar style.

## Implementation checklist
- [x] `computeDebtStatuses` in `balance.ts` + tests (TDD: red → green)
- [ ] `DebtHistoryRow` component
- [ ] `frontend/src/app/clients/[id]/page.tsx`
- [ ] 375 / 768 / 1024+ layout check
- [ ] Wire "Ajouter dette", "WhatsApp" (inert), 404 state
- [ ] Lint / typecheck / build
