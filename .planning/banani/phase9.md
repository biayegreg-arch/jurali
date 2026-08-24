# Phase 9 (partial) — Rappels automatiques + Export PDF

No new Banani screens fetched — the user picked 2 of the 4 Phase 9 backlog
items (see roadmap's "Phase 9" section) via AskUserQuestion:
**Rappels WhatsApp automatiques** and **Export PDF du reçu / historique**.
Bulk contact selection + SMS channel + response tracking were NOT picked
and remain backlog.

## Auto-reminders — the WhatsApp Business API constraint

A truly silent, server-triggered WhatsApp send is not possible with this
app's `wa.me`-link integration (Phase 8) — only the paid WhatsApp Business
API supports that, and the roadmap already ruled it out (A.3: "the PRD
didn't scope budget/infra for it"). So "automatique" can only mean:
the app detects overdue debts and surfaces them — the boutiquier still
taps to actually send. Asked the user how that surfacing should look
(AskUserQuestion, 2 options: in-app notification vs. a dedicated
"Rappels à envoyer" list page) — chose **in-app notification**, reusing
the starter's existing generic `Notification` system rather than building
new UI surface.

## Backend

- `User.autoReminderEnabled Boolean @default(false)` — global per-user
  opt-in (matches Parametres.jsx's single toggle, not per-client).
  Defaults **false**: existing users never consented, and the toggle only
  does anything for Premium accounts anyway (mirrors Phase 8's manual
  gate) — migration `20260824201620_jurali_auto_reminders`.
  - **Not folded into `NotificationPreferences.prefs`**: that JSON blob's
    documented contract (D-10) is "missing event-type ⇒ enabled" (an
    opt-out delivery-channel preference for an event that's already
    firing). This toggle is the opposite — a business-logic gate that
    must default OFF. Reusing the same blob would either violate its
    own invariant or require a special-cased key inside it. A dedicated
    `GET/PATCH /api/settings/auto-reminders` route stays cleaner.
- `lib/server/jurali/auto-reminder.ts` — pure `isDueForAutoReminder()`
  (TDD, 9 tests): phone + balance > 0 + oldest unpaid debt 7+ days old +
  no reminder sent since that debt started aging. Reuses
  `oldestUnpaidDebtDate`/`computeClientBalance` from Phase 1's balance.ts
  rather than re-deriving aging logic.
- `notifications/templates.ts` → `autoReminderDue()`. `dedupeKey` is keyed
  off `clientId` + the *oldest-unpaid-debt date* (not a cron-tick
  timestamp), so it fires once per "new oldest overdue debt" — paying
  off the flagged debt and letting a different one age past 7 days
  produces a fresh notification; re-running the cron on the same
  unresolved debt does not spam.
- `POST /api/cron/auto-reminders` (hourly, `0 * * * *`) — scans users
  with `autoReminderEnabled: true` AND `isSubscriptionActive`-equivalent
  Prisma filter (`status: 'ACTIVE', renewsAt: { gt: now }`), computes the
  predicate per client, creates notifications. `vercel.json` bumped to 7
  crons; `vercel-json-shape.test.ts`'s hardcoded counts bumped 6 → 7
  (both the length assertion and the explicit path list) — not a
  protected file, just the doc tripwire CLAUDE.md describes as fair game.
- `GET /api/auth/me` extended to return `shopName` (needed by both the
  reminder notification body and the PDF header) — this route handler
  isn't in CLAUDE.md's protected list (only `lib/server/auth.ts` core is);
  `AuthContext.tsx`'s `User` interface gained the matching field.

## Frontend — auto-reminders

- `TopBar`'s bell icon (previously a static `opacity-60` decoration with
  no handler — a pre-existing bit of inert UI from Phase 4, now closed)
  is wired for real: `useApi('/api/notifications/count')` badge, `Link`
  to a new `/notifications` page.
- `/notifications` — minimal list (reuses the existing paginated
  `GET /api/notifications` + `PATCH` mark-read routes verbatim, no new
  backend). Clicking a row with `data.clientId` navigates to that fiche
  client and marks it read; "Tout marquer lu" for the rest. No cursor
  pagination UI in this pass (YAGNI — same bar as `/api/clients` GET's
  own justification for skipping cursor pagination on a bounded list).
- `settings/page.tsx` gets a new "Notifications & Rappels" section
  (previously entirely omitted per `parametres.md`'s Phase 5 decision,
  now built for real) — a working toggle for Premium users, a `/premium`
  upsell link (same treatment as Phase 8's `ReminderCard`) for everyone
  else, so a free-tier user never sees a control that would be a no-op.

## PDF export

- `jspdf` added as a dependency — client-side generation only, no server
  route. Matches CLAUDE.md's Vercel-serverless-first guidance (no
  Puppeteer/headless-browser rendering, no cold-start risk for what's
  just formatting already-fetched data).
- `lib/jurali-pdf.ts` — `buildClientHistoryPdf()` (shop name, client
  identity, balance, full transaction history with pagination past
  page 1) + `buildPdfFilename()` (accent-stripped slug). TDD (7 tests) —
  jsPDF runs fine under plain Node (verified before committing to this
  approach), so the actual document construction is tested, not just a
  filename helper.
- Fiche client gets an "Exporter PDF" button, Premium-gated identically
  to the reminder card (`/premium` upsell link for free users, real
  `downloadClientHistoryPdf()` call for Premium) — matches the feature
  list `/premium` already advertises ("Export CSV & PDF" as
  Premium-exclusive; only the PDF half is built here, CSV wasn't asked
  for).

## Testing

- `auto-reminder.test.ts` (9), `cron/auto-reminders/route.test.ts` (8),
  `settings/auto-reminders/route.test.ts` (6), `jurali-pdf.test.ts` (7),
  `vercel-json-shape.test.ts` updated (6→7), `auth/me/route.test.ts`
  unaffected (still 4, `toMatchObject` partial-match tolerates the new
  field).

## Verification limitation (stated explicitly, not glossed over)

Every backend path was verified end-to-end against the live dev DB:
signup → toggle on → backdated 9-day-old debt via direct Prisma insert
(the API always stamps `now()`, so aging had to be seeded directly) →
Premium activated → cron run twice (second run confirms dedup, DB row
count stays 1) → notification correct (title/body/clientId) → mark-read
→ count drops to 0. **The client-only interactive pieces — the toggle's
visual on/off state, the PDF button's gated-vs-functional appearance,
and the actual click → jsPDF → file-download flow — were NOT verified in
a real browser.** Every page in this app is `'use client'` and renders
empty on a bare curl fetch until client-side JS hydrates and fetches
`/api/auth/me` (confirmed here: `/settings`, `/clients/[id]`,
`/notifications` all returned 0-byte bodies via curl, same as every
prior phase's auth-gated pages in this session) — there is no headless
browser tool available in this environment to click through it. Typecheck
+ lint + build all passed clean, which rules out compile-time JSX errors,
but does not prove the toggle renders or the PDF actually downloads.

## Implementation checklist
- [x] `User.autoReminderEnabled` + migration
- [x] `auto-reminder.ts` (TDD)
- [x] `templates.ts` → `autoReminderDue`
- [x] `POST /api/cron/auto-reminders` + tests + vercel.json + tripwire bump
- [x] `GET/PATCH /api/settings/auto-reminders` + tests
- [x] `GET /api/auth/me` → `shopName`
- [x] `TopBar` bell wired for real
- [x] `/notifications` page
- [x] Settings "Notifications & Rappels" section
- [x] `jurali-pdf.ts` (TDD) + `jspdf` dependency
- [x] Fiche client "Exporter PDF" button, Premium-gated
- [x] typecheck/lint/format/build clean
- [x] Backend verified end-to-end against dev DB
- [ ] Client-only UI (toggle visuals, PDF download click) — NOT verified,
      no browser automation available; flagged above, not glossed over

## Month-picker (Phase 9 remainder, 2026-08-25)

Remaining Phase 9 backlog item picked by the user via AskUserQuestion:
"Month-picker d'abord" (built standalone, ahead of the bulk-select/SMS/
response-tracking bundle, which the user deliberately deferred to decide
on separately). Source: Banani's `MonthPickerView` — explicitly a UI
affordance for browsing history, not a PRD requirement (roadmap A.3/A.7).

### Scope decision
Dashboard-only: the picker scopes the 2 "Historique mensuel" stat cards
(Récupéré / Nouvelles dettes) it introduces. The existing debtor-row list
above it is deliberately **not** month-scoped — it stays "recent activity
across all time," matching `debtor-list.md`'s own precedent of keeping
new UI additions thin rather than restructuring an existing list's
semantics. Not asked about — same "one obviously-correct scope" bar used
throughout this session.

### Backend — `GET /api/dashboard`, additive only
- `lib/server/jurali/month-range.ts` (new, no `'server-only'` marker —
  deliberately client-safe since `MonthPicker.tsx` also imports
  `shiftMonth`/`formatMonthParam`/`formatMonthLabelFr` from it directly):
  `parseMonthParam` (`YYYY-MM` → `{year, month}`, 0-indexed internally to
  match `Date`, defaults to current month on missing/malformed/
  out-of-range input — never 400s), `monthBounds` ([start, end) pair),
  `formatMonthParam`, `shiftMonth` (year-rollover-safe both directions),
  `formatMonthLabelFr` (capitalized French "Août 2026" label via
  `Intl.DateTimeFormat('fr-FR', …)`). TDD, 12 tests.
- Route extended additively: reads `?month=`, adds 3 new response fields
  (`selectedMonth`, `selectedMonthRecoveredFcfa`,
  `selectedMonthNewDebtsFcfa`, `selectedMonthTransactionCount`) scoped to
  `[monthStart, monthEnd)`. The pre-existing unbounded `recoveredThisMonthFcfa`
  field is left untouched for backward compatibility — nothing else
  consumed it, but there was no reason to churn it in the same change as
  an additive feature. 3 new tests (default-to-current-month,
  scoped-to-requested-month with `toHaveBeenNthCalledWith` assertions on
  the aggregate calls, malformed-param-falls-back); 8/8 passing.

### Frontend
- `components/jurali/MonthPicker.tsx` (new) — prev/next chevron nav +
  centered French month label; "next" disables once back at the current
  month (`month >= currentParam` string-lexicographic compare on
  zero-padded `YYYY-MM`, which works correctly for this comparison).
- `dashboard/page.tsx` — `useState` holds the selected month
  (`YYYY-MM`, initialized to current month), feeds `/api/dashboard?month=`
  via the existing `useApi` hook; new "Historique mensuel" section
  inserted between the debtor list and the 2 action buttons, with the
  `MonthPicker` plus 2 stat cards. `DashboardData` interface updated to
  match the route's new field names.

### Testing
- `month-range.test.ts` (new, 12 tests): `parseMonthParam` default/valid/
  malformed/out-of-range, `monthBounds` mid-year + December rollover,
  `formatMonthParam`, `shiftMonth` forward/backward + both year-rollover
  directions, `formatMonthLabelFr` August/January.
- `dashboard/route.test.ts`: +3 tests (8 total, all passing).
- Full suite: 727 tests, 726 passed / 1 failed — the same long-established
  flaky bcrypt-timeout test in `auth/signup/route.test.ts`
  ("returns 429 TOO_MANY_SIGNUP_ATTEMPTS…", CPU-contention timeout,
  unrelated to this change), reconfirmed passing clean in an isolated
  re-run (8/8).

### Verification
`pnpm typecheck && pnpm lint && pnpm format` all clean. `pnpm build`
clean — `/api/dashboard` and `/dashboard` both compile. Live end-to-end
verification against the dev DB (phone-signup → create client → post a
DEBT + a PAYMENT → `GET /api/dashboard` default, `?month=2026-01`
no-data, `?month=notamonth` malformed) confirmed: current-month default
scoping, correct zeroed response for a past month with no transactions,
and correct fallback-to-current-month for a malformed param. Test data
cleaned up afterward (user + client + transactions deleted directly via
Prisma — no `DELETE /api/clients/[id]` route exists in this app).

**Not verified**: the `MonthPicker` component's actual click-through
behavior in a browser (chevron taps, next-button disable state, label
formatting as rendered) — same standing limitation as every other
client-only piece this session (no browser-automation tool available).
Typecheck/build passing rules out compile-time errors only.

### Implementation checklist
- [x] `month-range.ts` (TDD, 12 tests)
- [x] `GET /api/dashboard` extended additively (+3 tests, 8 total)
- [x] `MonthPicker.tsx` component
- [x] `dashboard/page.tsx` wired in
- [x] typecheck/lint/format/build clean
- [x] Backend verified end-to-end against dev DB (3 month scenarios)
- [ ] Client-only UI (chevron clicks, disable state) — NOT verified, no
      browser automation available
