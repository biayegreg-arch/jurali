# Banani implementation status

Last updated: 2026-08-24

## Done
- [x] `dashboard` — `frontend/src/app/page.tsx` — plan: `dashboard.md` — commit: `52bce00`
- [x] `debtor-list` — `frontend/src/app/clients/page.tsx` — plan: `debtor-list.md` — commit: `52bce00`
- [x] `new-debt` — `frontend/src/app/debts/new/page.tsx` — plan: `new-debt.md` — commit: `52bce00`
- [x] `payment-receive` — `frontend/src/app/payments/new/page.tsx` — plan: `payment-receive.md` — commit: `52bce00` (no matching Banani screen; built fresh per confirmed decision, see plan)
- [x] `fiche-client` — `frontend/src/app/clients/[id]/page.tsx` — plan: `fiche-client.md` — commit: pending
- [x] `parametres` — `frontend/src/app/settings/page.tsx` (restyle, same route) — plan: `parametres.md` — commit: pending

## In progress
(none)

## Pending (seen in Banani, not yet fetched/planned for implementation)
- `inscription` (`Inscription.jsx`) — Phase 6 (auth strategy resolved: phone+password) — blocked on Phase 6 backend (`User.phone`, phone-signup/login routes)
- `page-premium` (`PagePremium.jsx`) — Phase 7 — blocked on Phase 7 backend (`Subscription` model, Bictorys checkout)
- Desktop variants (`DashboardDesktopWithMonthPicker`, `DebtorListDesktop`,
  `NewDebtDesktop`, `PaymentReceivedDesktop`) — reference only for now,
  informing responsive decisions in the 4 in-progress plans above; not
  implemented as separate routes
- Month-picker, PDF export, WhatsApp bulk-reminder/SMS/receipt-sharing
  screens (first batch) — Phase 9 backlog per roadmap A.3/A.7

## Open design questions
(none — Phase 4 batch resolved 2026-08-24, see .planning/banani/*.md "Decisions" sections)
