# Paiement reçu — Banani → Next.js/Tailwind v4 (GAP — needs user confirmation)

## Source
- `PaymentReceipt.jsx` (first batch) + `PaymentReceivedDesktop.jsx`
  (second batch)
- Fetched: 2026-08-24

## The gap
Both fetched screens are **printable/shareable RECEIPTS for a batch
collection already completed** — `PaymentReceivedDesktop` literally reads
"Paiements confirmés ! 3 dettes marquées comme payées · 102 500 FCFA
collectés" and lists 3 different clients (Cheikh Diop, Ibrahima Fall,
Moussa Ndiaye) in one receipt. Neither screen has an amount input, a
client selector, or anything resembling PRD 3.4's flow: *"Sélectionner le
client qui rembourse → Saisir le montant remboursé → Voir le solde
restant mis à jour → Valider."* That entry-form screen doesn't exist in
either fetched batch.

This mirrors the "Rappels automatiques" pattern from the roadmap's A.7
amendment: the designer explored a richer, bulk-oriented product
(multi-client debt collection sessions) than the PRD's MVP describes
(one-client-at-a-time). Same call as A.7 there: **ship the PRD's simpler
version for V1**, not the bulk one — a bulk "mark N debts paid across N
clients in one sweep" flow needs its own selection UI and is real scope
beyond Phase 4.

## Recommended approach (flagged for veto)
1. Build a **new** single-payment entry form, not sourced from a Banani
   mockup, reusing `new-debt.md`'s `ClientPicker` + `AmountField`
   components (same visual language, same interaction pattern, just
   `type: "PAYMENT"` instead of `"DEBT"` and no note field) — matches PRD
   3.4 exactly, matches `POST /api/transactions` as already built.
2. For the post-submit confirmation, adapt `PaymentReceipt.jsx`'s
   **visual style** (the bordered printable-card aesthetic, JURALI
   header, date/time, total) but for **one client's one payment**, not
   the batch list — same design language, single-row content instead of
   3 rows.
3. Defer the actual bulk-collection feature (`PaymentReceivedDesktop`'s
   real subject) to Phase 9 alongside the other Banani-only extras.

## Route
`frontend/src/app/payments/new/page.tsx`, auth-gated, accepts optional
`?clientId=`.

## Data
- `POST /api/transactions` `{clientId, type: "PAYMENT", amountFcfa}`
- On `422 PAYMENT_EXCEEDS_BALANCE`: inline error under the amount field
  showing the client's actual balance (already returned by
  `GET /api/clients/[id]` if pre-fetched, or by re-fetching on error)

## Responsive plan
Same as `new-debt.md` — 375px base, centered form on md/lg, no sidebar.

## Interactions / state
- Amount field pre-fills with the client's current balance when a client
  is selected (US-03: full or partial repayment — showing the full-balance
  default makes "repay everything" the 1-tap path, with the field still
  editable for partial payments)
- Success: receipt-styled confirmation (see above) with a "Nouveau
  paiement" / "Retour au dashboard" pair of actions

## Decisions (confirmed 2026-08-24)
- Approach: build the new single-payment form (recommended option above).
- Amount field pre-fills with the client's full current balance.
