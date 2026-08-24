# Banani implementation status

Last updated: 2026-08-24

## Done
- [x] `dashboard` — `frontend/src/app/page.tsx` — plan: `dashboard.md` — commit: pending
- [x] `debtor-list` — `frontend/src/app/clients/page.tsx` — plan: `debtor-list.md` — commit: pending
- [x] `new-debt` — `frontend/src/app/debts/new/page.tsx` — plan: `new-debt.md` — commit: pending
- [x] `payment-receive` — `frontend/src/app/payments/new/page.tsx` — plan: `payment-receive.md` — commit: pending (no matching Banani screen; built fresh per confirmed decision, see plan)

## In progress
(none)

## Pending (seen in Banani, not yet fetched/planned for implementation)
- `fiche-client` (`FicheClient.jsx`) — Phase 5
- `inscription` (`Inscription.jsx`) — Phase 6 (auth strategy resolved: phone+password)
- `parametres` (`Parametres.jsx`) — Phase 5
- `page-premium` (`PagePremium.jsx`) — Phase 7
- Desktop variants (`DashboardDesktopWithMonthPicker`, `DebtorListDesktop`,
  `NewDebtDesktop`, `PaymentReceivedDesktop`) — reference only for now,
  informing responsive decisions in the 4 in-progress plans above; not
  implemented as separate routes
- Month-picker, PDF export, WhatsApp bulk-reminder/SMS/receipt-sharing
  screens (first batch) — Phase 9 backlog per roadmap A.3/A.7

## Open design questions
(none — Phase 4 batch resolved 2026-08-24, see .planning/banani/*.md "Decisions" sections)
