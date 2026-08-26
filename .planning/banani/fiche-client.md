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
  **UPDATE 2026-08-24 (Phase 8, see `phase8-reminder.md`):** now fully
  functional — real `POST /api/clients/[id]/remind` call, real `wa.me`
  redirect, real `lastReminderSentAt` indicator. Only shown when the
  client has a phone + an outstanding balance (US-07); grayed to a
  real `/premium` upsell link for non-Premium users instead of the
  earlier fully-inert placeholder.
- **Per-debt Statut (Payée/En retard)** — BUILT for real via `computeDebtStatuses` (FIFO derivation over existing transaction data, no schema change) — this is genuine, useful data, not a Banani-only embellishment, and the roadmap already pre-approved this exact approach (A.7).
- **"Modifier" (edit client identity)** — OMITTED, no `PATCH /api/clients/[id]` endpoint exists. Not built this phase (would be new backend surface, out of the "Fiche client + Paramètres, no new backend" scope the user picked).
- **`UserAvatar` (Banani shared component)** — not pulled in; Phase 4 already established initials-circle avatars (`DebtorRow` pattern) as the project's actual avatar treatment — kept consistent instead of introducing a second avatar style.

## Implementation checklist
- [x] `computeDebtStatuses` in `balance.ts` + tests (TDD: red → green)
- [x] `DebtHistoryRow` component
- [x] `frontend/src/app/clients/[id]/page.tsx`
- [x] 375 / 768 / 1024+ layout check
- [x] Wire "Ajouter dette", "WhatsApp" (inert), 404 state
- [x] Lint / typecheck / build

## UPDATE 2026-08-26 (desktop redesign, `FicheClient.jsx` re-fetched alongside `CreateClientDesktop.jsx`)

Companion batched `AskUserQuestion` round (all answered "Recommandé"), superseding several 2026-08-24 decisions above:

- **Client contact fields** — `Client.email` and `Client.address` added to the schema
  (migration `20260826000422_jurali_client_contact_fields`). Both display on
  the fiche (mobile + desktop identity card) and are editable.
- **"Modifier" (edit client identity)** — now REAL. `PATCH /api/clients/[id]`
  (partial update: firstName/phone/email/address, ownership-checked,
  404 `CLIENT_NOT_FOUND`) + `frontend/src/app/clients/[id]/edit/page.tsx`,
  sharing a new `ClientForm` component with the create flow (see
  `new-debt.md` for `CreateClientDesktop.jsx`'s companion decisions).
  Supersedes the 2026-08-24 "OMITTED, no PATCH endpoint" note above.
- **"Avance payée" block** — seen in the desktop mock, DROPPED entirely: no
  backing concept in the data model (debts/payments have no "advance"
  distinction) and fabricating one would be exactly the kind of half-real
  UI this project avoids.
- **"Prochain rappel" date** — the desktop mock showed a literal fixed date
  ("19 janv. 2024 09:00"). Replaced with a genuinely DERIVED date:
  `oldestUnpaidDebtDate + AUTO_REMINDER_THRESHOLD_DAYS` (7 days), computed
  in the new `useFicheDerived(client)` hook and rendered as "Rappel
  automatique éligible à partir du {date}" — real data, not a Banani
  placeholder.
- **"Marquer les dettes en retard comme payées"** — now REAL, reversing the
  2026-08-24 "OMITTED" decision above. Since debts/payments have no mutable
  "paid" status (always FIFO-derived), reframed as a single
  `POST /api/transactions {type:'PAYMENT', amountFcfa: overdueBalanceFcfa}`
  for the exact overdue balance — consistent with the existing data model,
  no schema change. New `computeOverdueBalance` in `balance.ts` (FIFO
  remaining-sum of debts currently overdue, `balance.test.ts`, 6 new tests).
  Built via a new `MarkOverdueAsPaidButton`, shown on BOTH mobile and
  desktop (not desktop-exclusive).
- **Desktop layout** — `useFicheDerived(client)` hook computes shared
  derived values once (debtStatuses, debtCount, overdueCount,
  totalPaidFcfa, overdueBalanceFcfa, nextEligibleReminderDate, history),
  passed as props to both `MobileFicheBody` and `DesktopFicheBody` (no
  duplicate computation, no duplicate fetch — `ReminderCard`'s local
  send-button state is safe to duplicate since it holds no fetched data).
  Desktop adds: identity card with address + "Dernière activité" +
  "Modifier" link; 2×2 `StatTile` grid; debt-history TABLE with
  Toutes/En retard/Payées filter tabs; desktop top bar's "Envoyer
  WhatsApp" is an anchor-scroll link (`href="#reminder-card"`) to the
  single canonical `ReminderCard` instance rather than a duplicate
  send-logic — avoids divergent duplicate mutation logic.
- **"Fidèle" loyalty badge** — seen in the mock, DROPPED (no backing
  concept, same "no fake data" reasoning as "Avance payée").

## UPDATE 2026-08-26, #2 (re-fetch alongside `DettesEnRetardDesktop.jsx`)

User re-selected `FicheClient.jsx` (screenshot showed the updated mock) —
re-fetched and diffed. Two new elements this time, resolved via a batched
`AskUserQuestion` (confirmed "Recommandé"):

- **"Suivi des paiements" panel** — built for REAL, scoped to the client's
  current OLDEST unpaid debt (FIFO means only one debt is ever "being paid
  down" at a time — the same reasoning `oldestUnpaidDebtDate` already
  uses). New `computeOldestDebtProgress` in `balance.ts`: walks the same
  FIFO allocation as the other balance helpers, but for the current oldest
  debt specifically returns `{originalAmountFcfa, remainingFcfa, events[]}`
  where each event is a payment that contributed to paying it down
  (`amountAppliedFcfa` + running `remainingAfterFcfa`) — correctly splits a
  single payment across two debts when it overflows from one to the next.
  Returns `null` once every debt is settled (panel hides itself, same
  pattern as `ReminderCard`/`MarkOverdueAsPaidButton`). Not Premium-gated:
  paying down debts is core functionality, same tier as the existing
  "Total dû"/"Total payé" tiles. "Ajouter un versement" is NOT a new
  mutation — it's the exact same `POST /api/transactions
  {type:'PAYMENT'}` every other payment flow already uses; FIFO allocation
  automatically applies it to the oldest debt shown. Zero schema change.
  Shown on BOTH mobile and desktop (new `PaymentTrackingCard` component),
  not desktop-exclusive.
- **"Fidèle" badge** — reintroduced in this mock, but STAYS dropped — no
  real definition was given for what makes a client "loyal", and the
  2026-08-24 decision above already established the "no fake badge with no
  backing concept" precedent. Not re-litigated, re-confirmed by the user.
