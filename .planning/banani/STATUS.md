# Banani implementation status

Last updated: 2026-08-25 (Google sign-in button)

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
- [x] `phase8-reminder` — no new Banani screen; wires up the reminder card already placed on `fiche-client` (Phase 5) — `frontend/src/app/api/clients/[id]/remind/route.ts` + `clients/[id]/page.tsx` — plan: `phase8-reminder.md` — commit: `ae55c70`
- [x] `phase9` (partial — auto-reminders + PDF export only) — no new Banani screens; user picked 2 of 4 backlog items — `frontend/src/app/api/cron/auto-reminders/`, `api/settings/auto-reminders/`, `app/notifications/page.tsx`, `lib/jurali-pdf.ts` — plan: `phase9.md` — commit: `263ccab`
- [x] `phase9` (month-picker) — no new Banani screen fetch (reused prior `MonthPickerView` reference); Dashboard-only, scopes 2 new stat cards — `frontend/src/lib/server/jurali/month-range.ts`, `components/jurali/MonthPicker.tsx`, `api/dashboard/route.ts` (additive), `dashboard/page.tsx` — plan: `phase9.md` § Month-picker — commit: `9ec2575`
- [x] `inscription` (Google sign-in button) — no new Banani screen; user requested connecting Google OAuth to actually test login — `components/jurali/GoogleIcon.tsx`, `GoogleSignInButton.tsx`, wired into `signup/page.tsx` + `login/page.tsx` — plan: `inscription.md` § Google Sign-in button — commit: pending

## In progress
(none)

## Pending (seen in Banani, not yet fetched/planned for implementation)
- Desktop variants (`DashboardDesktopWithMonthPicker`, `DebtorListDesktop`,
  `NewDebtDesktop`, `PaymentReceivedDesktop`) — reference only for now,
  informing responsive decisions in the 4 in-progress plans above; not
  implemented as separate routes
- Bulk contact selection + SMS channel + response-tracking bundle —
  remaining Phase 9 backlog per roadmap A.3/A.7; user deliberately
  deferred deciding on this until after month-picker shipped

## Open design questions
(none — Phase 4 batch resolved 2026-08-24, see .planning/banani/*.md "Decisions" sections; landing-page.md's routing decision documented, not asked, per the session's established bar)
