# Banani implementation status

Last updated: 2026-08-24

## Done
- [x] `dashboard` — `frontend/src/app/dashboard/page.tsx` (moved from `/` — see `landing-page.md`) — plan: `dashboard.md` — commit: `52bce00` (move: pending)
- [x] `debtor-list` — `frontend/src/app/clients/page.tsx` — plan: `debtor-list.md` — commit: `52bce00`
- [x] `new-debt` — `frontend/src/app/debts/new/page.tsx` — plan: `new-debt.md` — commit: `52bce00`
- [x] `payment-receive` — `frontend/src/app/payments/new/page.tsx` — plan: `payment-receive.md` — commit: `52bce00` (no matching Banani screen; built fresh per confirmed decision, see plan)
- [x] `fiche-client` — `frontend/src/app/clients/[id]/page.tsx` — plan: `fiche-client.md` — commit: `eab4b15`
- [x] `parametres` — `frontend/src/app/settings/page.tsx` (restyle, same route) — plan: `parametres.md` — commit: `eab4b15`
- [x] `inscription` — `frontend/src/app/signup/page.tsx` + companion `frontend/src/app/login/page.tsx` (no Banani source, built fresh) — plan: `inscription.md` — commit: `098bcbc`
- [x] `page-premium` — `frontend/src/app/premium/page.tsx` + companions `frontend/src/app/premium/{success,failed}/page.tsx` (no Banani source, built fresh) — plan: `page-premium.md` — commit: `75dc660`
- [x] `landing-page` — `frontend/src/app/page.tsx` (new home; Dashboard moved to `/dashboard`) — plan: `landing-page.md` — commit: `87f2bb3`
- [x] `phase8-reminder` — no new Banani screen; wires up the reminder card already placed on `fiche-client` (Phase 5) — `frontend/src/app/api/clients/[id]/remind/route.ts` + `clients/[id]/page.tsx` — plan: `phase8-reminder.md` — commit: pending

## In progress
(none)

## Pending (seen in Banani, not yet fetched/planned for implementation)
(none — all 9 screens from the Banani flow are now built)
- Desktop variants (`DashboardDesktopWithMonthPicker`, `DebtorListDesktop`,
  `NewDebtDesktop`, `PaymentReceivedDesktop`) — reference only for now,
  informing responsive decisions in the 4 in-progress plans above; not
  implemented as separate routes
- Month-picker, PDF export, WhatsApp bulk-reminder/SMS/receipt-sharing
  screens (first batch) — Phase 9 backlog per roadmap A.3/A.7

## Open design questions
(none — Phase 4 batch resolved 2026-08-24, see .planning/banani/*.md "Decisions" sections; landing-page.md's routing decision documented, not asked, per the session's established bar)
