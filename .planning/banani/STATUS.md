# Banani implementation status

Last updated: 2026-08-26 (fiche-client + create-client desktop redesign, Paramètres desktop redesign)

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
- [x] `inscription` (Google sign-in button) — no new Banani screen; user requested connecting Google OAuth to actually test login — `components/jurali/GoogleIcon.tsx`, `GoogleSignInButton.tsx`, wired into `signup/page.tsx` + `login/page.tsx` — plan: `inscription.md` § Google Sign-in button — commit: `8bb1e13`
- [x] `debtor-list` (desktop sidebar + table) — Banani screen `DashboardDesktopWithMonthPicker.jsx` ("Jurali — Dashboard Desktop"), mapped to `/clients` (not `/dashboard`) after confirming scope with the user — `components/jurali/DesktopSidebar.tsx`, `DebtorTableRow.tsx`, `api/clients/route.ts` (`?month=`, additive), `clients/page.tsx` (lg+ layout) — plan: `debtor-list.md` § Desktop sidebar + table — commit: `0918d90`
- [x] `dashboard` (desktop sidebar + table) — same Banani screen, now ALSO mounted on `/dashboard` — user reviewed `/clients` desktop, then explicitly (twice) confirmed they want this on `/dashboard` specifically ("pas /clients") — `lib/useDebtorListState.ts` + `components/jurali/DesktopDebtorWorkspace.tsx` extracted so both routes share one implementation — plan: `dashboard.md` § Desktop sidebar + table — commit: pending
- [x] `dashboard`/`debtor-list` (component-completeness fix) — user pointed out 3 missing elements vs. the Banani capture (real name + "Propriétaire" in the sidebar identity block, "Statistiques" nav item, month subtitle) — `api/auth/me/route.ts` (`name`, TDD), `AuthContext.tsx`, `DesktopSidebar.tsx`, `DesktopDebtorWorkspace.tsx` — plan: `dashboard.md` § Component-completeness fix — commit: pending

- [x] `statistics` — `frontend/src/app/stats/page.tsx` + `api/stats/route.ts` — Banani screen `StatisticsDesktop.jsx`, Premium-gated — `lib/server/jurali/stats.ts`, `components/jurali/StatCard.tsx`, `settings/page.tsx` (Analyse section, mobile reachability) — plan: `statistics.md` — commit: pending
- [x] `new-debt` (desktop sidebar + 2-column layout) — Banani screen `NewDebtDesktop.jsx` — reverses the 2026-08-24 "no sidebar" decision after the user reselected + confirmed — `components/jurali/ClientPicker.tsx` (`inputId` prop) — plan: `new-debt.md` § Desktop layout reversal — commit: pending

- [x] `fiche-client` (desktop redesign) — Banani screen `FicheClient.jsx` (desktop) re-fetched alongside `CreateClientDesktop.jsx` — real client email/address + edit (`PATCH /api/clients/[id]`), real "Marquer les dettes en retard comme payées" bulk-pay, real derived "Prochain rappel" date, dropped fabricated "Avance payée"/"Fidèle" — `clients/[id]/page.tsx` (`useFicheDerived` hook, `MobileFicheBody`/`DesktopFicheBody` split), `clients/[id]/edit/page.tsx`, `components/jurali/ClientForm.tsx`, `lib/server/jurali/balance.ts` (`computeOverdueBalance`) — plan: `fiche-client.md` § UPDATE 2026-08-26 — commit: pending
- [x] `create-client` — Banani screen `CreateClientDesktop.jsx` (previously seen and deferred 2026-08-26, now implemented as part of the same batched decision as `fiche-client` desktop above) — `frontend/src/app/clients/new/page.tsx`, shares `ClientForm`/`ClientFormInfoPanel` with the edit flow; `new-debt.md`'s "Créer client" button now links here (`?next=/debts/new`) instead of the earlier focus-shortcut — plan: `fiche-client.md` § UPDATE 2026-08-26, `new-debt.md` § Créer client button — superseded — commit: pending
- [x] `parametres` (desktop redesign) — Banani screen `Parametres.jsx` (desktop) re-fetched — real profile editing (`PATCH /api/auth/me`, adds `User.address`), new 14-day "Notifications dettes en retard" toggle + cron (distinct from the existing 7-day WhatsApp reminder), global Premium CSV export (`GET /api/clients/export` + `lib/jurali-csv.ts`), dropped fabricated PIN app-lock + password-last-changed date; also fixed a duplicate `/settings` link in `DesktopSidebar` (nav-list item removed, identity-block link kept + given active-state) — `settings/page.tsx`, `api/settings/overdue-alerts/`, `api/cron/overdue-alerts/`, `lib/server/jurali/overdue-alert.ts` — plan: `parametres.md` § UPDATE 2026-08-26 — commit: pending

## In progress
(none)

## Pending (seen in Banani, not yet fetched/planned for implementation)
- `PaymentReceivedDesktop` — reference only for now; not implemented as a
  separate route.
- Bulk contact selection + SMS channel + response-tracking bundle —
  remaining Phase 9 backlog per roadmap A.3/A.7; user deliberately
  deferred deciding on this until after month-picker shipped.

## Open design questions
(none — Phase 4 batch resolved 2026-08-24, see .planning/banani/*.md "Decisions" sections; landing-page.md's routing decision documented, not asked, per the session's established bar)
