# Nouvelle dette — Banani → Next.js/Tailwind v4

## Source
- Banani screen IDs: `NewDebtForm.jsx` (filled-state mock) +
  `NewDebtForm2.jsx` (empty-state mock)
- Fetched: 2026-08-24 (first batch)

## Correction vs. the original roadmap (A.1 row 5)
The roadmap assumed a **2-step wizard** (select client → full-screen numeric
keypad), mirroring PRD 3.3's "Flux en 2 étapes". Reading both fetched
screens in full: they are the **same single-screen form** in two data
states (empty vs. pre-filled) — Client field, Montant dû field, Achetés
(note) field, and 4 quick-amount preset buttons are all visible
simultaneously on one screen, not sequential steps. Building this as ONE
page is both more accurate to the design and simpler than the originally
planned 2-route flow.

## Route
`frontend/src/app/debts/new/page.tsx`, auth-gated. Accepts an optional
`?clientId=` query param so a future fiche-client "Ajouter dette" button
(Phase 5) can deep-link with the client pre-selected.

## Structure map
- Top bar with back button, "Nouvelle dette" title, "Remplis les infos
  rapidement" subtitle
- Thin 3-segment progress bar (Banani shows it "optional, subtle" per its
  own comment) — first segment always filled; cosmetic only, no real
  step state since this is one screen. Recommend dropping it (it implies
  a 3-step flow that doesn't exist) — flagged for veto.
- Client field: search-as-you-type, shows matches from `/api/clients?q=`;
  selecting one fills the field. If no match, Banani has no explicit
  "create new client" affordance on THIS screen (unlike the PRD's US-05
  "si le client n'est pas trouvé, bouton Créer un nouveau client") — add
  a "Créer « {q} »" row at the bottom of the match list when the query has
  no exact match, calling `POST /api/clients` inline, per US-05 (PRD wins
  over the Banani mock's silence here — the mock's own client list is
  hardcoded seed data, not a design decision to omit creation)
- Montant field: numeric input, FCFA prefix, right-aligned large text
  (Banani has it `disabled` in the mock — that's a Banani mock artifact,
  not a real disabled state; build it as a real controlled numeric input)
- Montants rapides: 4 preset buttons (500 / 1 000 / 2 500 / 5 000 in the
  first batch; 500 / 1 000 / 10 000 / 25 000 in the second batch's
  `NewDebtDesktop` — the two disagree; use the second/more recent batch's
  values, flagged for veto)
- Achetés field: free-text note (PRD 3.3 "note optionnelle")
- Enregistrer la dette (primary) / Annuler (secondary)

## Component breakdown
- **NEW** `ClientPicker` (`src/components/jurali/ClientPicker.tsx`) —
  search input + dropdown of matches + inline "create new" row. Reusable
  for the payment-entry screen too (see `payment-receive.md`) — 2nd use
  case identified up front, extract now rather than after duplicating
- **NEW** `AmountField` — FCFA-prefixed numeric input + quick-preset row,
  same reasoning (payment-entry screen needs the same amount UX)
- **REUSE** `Icon`

## Data
- Search: `GET /api/clients?q=<debounced>&limit=8`
- Create-on-the-fly: `POST /api/clients` `{firstName}` (US-05 — phone
  optional, this screen never asks for it, matching Banani's client field
  being name-only)
- Submit: `POST /api/transactions` `{clientId, type: "DEBT", amountFcfa, note?}`
- On `409 CLIENT_LIMIT_REACHED` from the create-on-the-fly path: redirect
  to `/premium` (Phase 5/7, not built yet — until then, show a toast with
  the message and stay on the form) — matches US-06

## Responsive plan
- **375px**: exact Banani mobile mockup, full-width fields and buttons
- **md/lg**: `NewDebtDesktop` (second batch) shows a 2-column layout with
  a "Clients récents" sidebar + "Astuce" tip card. Recommend deferring the
  sidebar (it's a nice-to-have, not in the PRD) and just centering/capping
  the form width on desktop for V1 — flagged for veto since it's a visible
  simplification of the desktop mock

## Interactions / state
- Amount validation: positive integer only (matches `zPositiveInt` /
  `z.number().int().positive()` already enforced server-side in
  `POST /api/transactions` — mirror client-side for instant feedback)
- Submit loading: disable both buttons, spinner in "Enregistrer"
- Success: PRD 3.3/US-01 doesn't specify a confirmation screen (Banani's
  `DebtRecorded.jsx`, first batch, does exist as a dedicated confirmation
  — not yet read in full). Recommendation: toast "Dette enregistrée" +
  redirect to Dashboard (US-01's whole point is speed — an extra
  confirmation screen adds a tap). Flagged for veto against using
  `DebtRecorded.jsx` as a full-screen interstitial instead.
- Error (e.g. network): inline error banner above the buttons, form stays
  filled (never lose what the shopkeeper typed)

## Copy / i18n
French strings hardcoded per Banani source.

## Implementation checklist
- [ ] `ClientPicker.tsx` (search + create-on-the-fly)
- [ ] `AmountField.tsx` (FCFA input + presets)
- [ ] `page.tsx` wiring both to `POST /api/transactions`
- [ ] 409 CLIENT_LIMIT_REACHED handling
- [ ] 375 / 768 / 1024 check
- [ ] Confirm success UX (toast+redirect vs. DebtRecorded interstitial)

## Decisions (confirmed 2026-08-24)
- Progress bar: dropped.
- Quick-preset amounts: 500 / 1 000 / 10 000 / 25 000 (second batch).
- Success UX: toast "Dette enregistrée" + redirect to Dashboard.
- Desktop layout: simplified centered form, no sidebar.

## Audit fix (2026-08-25)
Arriving via a fiche client's "Ajouter une dette" link (`?clientId=`)
preloaded `ClientPicker` with `{id, firstName: ''}` — the search input
showed blank with no visual confirmation of who was selected, even though
the correct client was silently wired underneath. Fixed two ways: (1)
`ClientPicker` now syncs its internal input from the `value` prop
whenever `value.id`/`value.firstName` changes, not just on mount, so any
future caller providing a value post-mount displays correctly; (2) this
page now fetches the real client (`GET /api/clients/[id]`) when a
`clientId` param is present instead of constructing a name-less
placeholder.
