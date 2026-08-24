# Jurali Implementation Roadmap

> **For agentic workers:** This is a ROADMAP, not a bite-sized TDD plan. Each
> phase below is its own subsystem (per writing-plans "Scope Check" —
> multi-subsystem specs get split). When a phase starts, run
> `superpowers:writing-plans` again scoped to just that phase to produce the
> full bite-sized task list with code. Phase 1 is detailed enough to start
> directly because it's foundational and has no open decisions.

**Goal:** Turn the generic izikit SaaS starter into Jurali — the credit
notebook app for Senegalese shopkeepers — using the 37 Banani screens
imported from the "Carnet Jurali" flow as the UI source of truth.

**Architecture:** Reuse the starter's infra (Prisma/Neon, auth skeleton,
outbox, payments via Bictorys, admin back-office) and add Jurali's domain
layer (`Client`, `Transaction`) on top. Reproduce Banani screens pixel-1:1
via the `banani-design-implementation` skill, wired to new `/api/clients`
and `/api/transactions` routes.

**Tech Stack:** Next.js 16 App Router, Prisma 5 + Neon, Tailwind v4,
Bictorys (Wave/Orange Money), Lucide icons (Banani's icon set).

**Spec:** [planning_prd-jurali.md](../../../planning_prd-jurali.md) (sections
3–8: screens, MVP features, user stories, business model)

## Global Constraints

- Every new Route Handler: `export const runtime = 'nodejs'` + `requireAuth`
  + `verifyCsrf` on mutations (CLAUDE.md invariant, CI-enforced).
- Payment amounts: integer FCFA, no decimals (CLAUDE.md invariant).
- Do not modify protected files (`auth.ts`, `crypto.ts`, `webhook/handler.ts`,
  `middleware/index.ts`, etc. — see CLAUDE.md "Files Claude must NOT modify").
  Any change there needs an explicit "I am about to modify X because Y —
  confirm?" first.
- French only, no i18n system (PRD §8: hors scope V1).
- Mobile-first responsive web, not native (PRD §8).

---

## Part A — What Banani has vs. what the PRD asked for vs. what the starter has today

### A.1 — 37 Banani designs, deduplicated into 13 real screen types

Most of the 37 fetched designs are **state variants of the same two
screens** (12 months of dashboard data, filter states, notification states).
Deduplicated:

| # | Screen type (Banani source files) | Maps to PRD § | Starter today |
|---|---|---|---|
| 1 | Dashboard (`JuraliDashboard` + 20 month/filter/state variants) | 3.2 Accueil | Nothing (`page.tsx` returns `null`) |
| 2 | Liste des débiteurs, mobile + desktop (`DashboardAll`, `DashboardAllDesktop`) | 3.5 Liste des clients | Nothing |
| 3 | Dettes en retard (`OverdueDebts`) | 3.5 (indicateur ancienneté) | Nothing |
| 4 | Sélecteur de mois (`MonthPickerView` + `_next1`) | Not in PRD — UI affordance for browsing history | Nothing |
| 5 | Nouvelle dette, 2-step form (`NewDebtForm`, `NewDebtForm2`) | 3.3 Nouvelle dette | Nothing |
| 6 | Dette enregistrée — confirmation (`DebtRecorded`) | 3.3 (implicit) | Nothing |
| 7 | Reçu de paiement (`PaymentReceipt`, `PaymentsConfirmed`) | 3.4 Paiement reçu | Nothing |
| 8 | Sélection contacts WhatsApp (`SelectWhatsAppContacts` + `_next1`) | 3.6/US-07, but PRD is **single-client**, this is **bulk** | Nothing |
| 9 | Rappels WhatsApp envoyés + réponses (`RemindersSent`, `ReminderResponses`) | US-07 (last-reminder date), but PRD scope is much thinner | Nothing |
| 10 | Envoyer par SMS (`SendBySMS`, `SMSSent`) | **Not in PRD at all** | Nothing |
| 11 | Partager le reçu (`ShareReceipt`, WhatsApp/Email/SMS/Facebook/X/PDF/copy-link) | **Not in PRD at all** | Nothing |
| 12 | Télécharger le PDF (`DownloadPDF`, `PDFDownloaded`) | 5. Export PDF/Excel (Premium, P2) | Nothing |
| 13 | *(missing from the fetch)* signup/OTP, fiche client, paramètres, page Premium | 3.1, 3.6, 3.7, 3.8 | Nothing |

### A.2 — Screens the PRD requires that Banani did NOT return

These 4 screens are core to the PRD (3.1, 3.6, 3.7, 3.8) but weren't in the
selection you pulled:
- **3.1 Bienvenue / Inscription** (téléphone + code SMS)
- **3.6 Fiche client** (historique complet, solde, actions rapides) — this
  is arguably the single most-used screen after the dashboard
- **3.7 Paramètres / Mon compte**
- **3.8 Page d'abonnement Premium**

Either they don't exist yet in the Banani flow, or they exist but weren't
selected. **Action before Phase 4/6/7 below: go select them in Banani and
re-run the import.**

### A.3 — Banani screens that go BEYOND the PRD's stated V1 scope

The PRD (§8, hors-scope) and US-07 describe reminders as: *one button on
the fiche client, sends one pre-written WhatsApp message to one client, a
"last reminder sent" timestamp is shown.* Banani's flow is materially
bigger:
- **Bulk contact selection** for reminders (`SelectWhatsAppContacts`) vs.
  PRD's single-client button
- **SMS as a second reminder channel** (`SendBySMS`/`SMSSent`) — PRD only
  ever says WhatsApp
- **A reminder-response inbox** (`ReminderResponses`) tracking whether the
  client confirmed/postponed/saw the message — PRD has no such tracking,
  and WhatsApp's API doesn't give you delivery/read receipts for a
  wa.me-link flow (only the Business API does, which the PRD didn't scope
  budget/infra for)
- **Receipt sharing to Facebook/X/Email/copy-link** (`ShareReceipt`) —
  entirely new surface, no PRD user story covers it

None of this is a problem — the designer clearly explored a richer product
than the PRD's MVP cut. But it changes the backend surface a lot (contact
lists, multi-channel dispatch, response tracking needs a webhook or manual
status field). **Flagging as a decision, not silently building it all.**

### A.4 — Starter-kit gap: no domain model exists yet

`frontend/prisma/schema.prisma` currently has 14 models — all generic SaaS
scaffolding (`User`, `Order`, `Withdrawal`, `Organization`,
`AdminAction`, `OAuthAccount`, …). **Zero of them represent a client or a
debt.** The 40 existing API routes are all auth/admin/orders/withdrawals —
none of them are usable as-is for Jurali's actual feature set. This is
expected (the starter is domain-agnostic by design) but means Part B below
is 100% new code, not adaptation.

### A.5 — The one real architectural collision: auth

- **PRD** (3.1, US-08): phone number + SMS OTP code, **no password, no
  email**, session persists indefinitely.
- **Starter's `auth.ts`** (protected/battle-tested, CLAUDE.md forbids
  editing without explicit confirmation): `User.email` is `@unique`
  required, signup is email+password with an 8-char verification code sent
  presumably via email (Resend), refresh/access JWT pair, CSRF, the whole
  enumeration-resistant flow.

This can't be silently reconciled — it's a product decision. See "Decision
needed" below before Phase 6 is planned in detail.

### A.6 — Design tokens to adopt (from Banani's `sharedFiles`)

Banani shipped a full theme block — this becomes
`frontend/src/app/globals.css`'s `@theme` block (Tailwind v4):

```
--color-background: #F5F0E8   (warm cream)
--color-foreground: #1A1A1A
--color-primary: #1E5C3A      (forest green — top bars, primary CTAs)
--color-primary-foreground: #F5F0E8
--color-secondary: #C8DCC0    (pale green — avatars, chips)
--color-accent: #E8A020       (gold — "Nouvelle dette" CTA)
--color-danger: #C0392B       (overdue amounts)
--color-surface: #EDEAE0
--color-muted / --color-muted-foreground / --color-border / --color-input

font-body: DM Sans
font-headings: Space Grotesk
radius scale: sm 4px / md 8px / lg 12px / xl 20px
```

Plus 3 shared components already designed: `SummaryStat` (KPI tile),
`DebtorRow` (list row), `QuickAction` (FAB button) — these map directly to
PRD 3.2's "4 indicateurs" and "clients récents" requirements. Banani screens
use Lucide icons via a generic `<Icon i="name" />` wrapper and a `t()`
translation passthrough — both need real implementations in the codebase
(`lucide-react` + a trivial identity `t()` since V1 is French-only, per
CLAUDE.md's "don't build unneeded abstraction").

---

## Part B — Phased roadmap

Each phase produces working, demoable software. Order matters: B1 unblocks
everything else.

### Phase 0 — Decisions (RESOLVED 2026-08-24)

1. **Auth strategy: option (c)** — parallel `/api/auth/phone/*` flow,
   reuses `auth.ts`'s exported JWT/cookie primitives without editing the
   protected file. SMS provider: **Africa's Talking** (user-specified
   2026-08-24 — good Senegal/UEMOA coverage, cheaper than Twilio for local
   SMS).
2. **Reminder scope: PRD-thin version.** Phase 8 ships US-07 exactly (one
   button, one message, `wa.me` link, `lastReminderSentAt`). Banani's
   bulk/SMS/response-tracking extras stay in Phase 9 backlog, not built
   unless requested after Phase 8 ships.

### Phase 1 — Domain model (foundation, no open decisions)

**Goal:** `Client` and `Transaction` (dette/remboursement) exist in Prisma,
migrated to Neon, with balance-calculation covered by unit tests.

**Files:**
- Modify: `frontend/prisma/schema.prisma` — add 2 models
- Create: `frontend/prisma/migrations/5_jurali_domain/migration.sql` (via
  `pnpm db:migrate:dev`)
- Create: `frontend/src/lib/server/jurali/balance.ts` — pure function,
  `computeClientBalance(transactions: {type, amountFcfa}[]) => number`
- Test: `frontend/src/lib/server/jurali/balance.test.ts`

**Schema sketch** (owner = `User.id`, single-tenant per PRD §8 "un seul
utilisateur par compte en V1" — no org scoping needed):

```prisma
model Client {
  id            String        @id @default(cuid())
  ownerId       String
  owner         User          @relation(fields: [ownerId], references: [id])
  firstName     String
  phone         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  transactions  Transaction[]

  @@index([ownerId])
  @@index([ownerId, firstName])
}

model Transaction {
  id          String   @id @default(cuid())
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  type        String   // "DEBT" | "PAYMENT"
  amountFcfa  Int      // integer, no decimals — CLAUDE.md invariant
  note        String?
  createdAt   DateTime @default(now())

  @@index([clientId, createdAt])
  @@index([ownerId, createdAt])
}
```

Balance for a client = `sum(DEBT.amountFcfa) - sum(PAYMENT.amountFcfa)`.
"Ancienne" (>30 days, PRD 3.5/3.2) = oldest **unpaid** DEBT's `createdAt` —
computing this correctly needs either a running-balance walk or a
simplifying assumption (FIFO: payments clear the oldest debts first).
Recommend FIFO — it matches how a shopkeeper mentally tracks it and keeps
the query simple.

- [ ] Add `Client` + `Transaction` models to schema.prisma, add
      `clients Client[]` and `transactions Transaction[]` relations on `User`
- [ ] `pnpm db:migrate:dev --name jurali_domain`
- [ ] Write `computeClientBalance` + FIFO-aging helper with unit tests
      (empty history, debt-only, debt+partial payment, debt+overpayment
      edge case — PRD US-03 says balance floors at 0, extra stays as a
      credit or is rejected — **another small decision, default to
      rejecting overpayment with `AMOUNT_ABOVE_MAX`-style error for V1**)
- [ ] `pnpm typecheck && pnpm test`
- [ ] Commit

### Phase 2 — `/api/clients` + `/api/transactions` routes

**Goal:** CRUD + search matching US-01, US-03, US-05.

**Files:**
- Create: `frontend/src/app/api/clients/route.ts` (GET list+search+sort,
  POST create)
- Create: `frontend/src/app/api/clients/[id]/route.ts` (GET detail +
  transaction history, matches 3.6 fiche client's data needs)
- Create: `frontend/src/app/api/transactions/route.ts` (POST — body
  `{clientId, type, amountFcfa, note?}`, or `{firstName, phone?}` inline for
  create-client-on-the-fly per US-05)
- Test: sibling `route.test.ts` for each (follow existing pattern in
  `frontend/src/app/api/orders/route.test.ts`)

Each handler: `runtime = 'nodejs'`, `requireAuth`, `verifyCsrf` on POST,
`withRequestContext`. No org scoping (single-tenant). Free-tier gate (10
clients, PRD §4/§6) enforced in the `POST /api/clients` handler — count
`prisma.client.count({ownerId})`, if `>= 10` and user has no active
Premium subscription, return `409 CLIENT_LIMIT_REACHED` (stable error code,
per CLAUDE.md convention).

- [ ] Write route tests first (list/search/create/limit-reached) against
      `prismaMock` fixtures
- [ ] Implement routes
- [ ] `pnpm typecheck && pnpm test`
- [ ] Commit

### Phase 3 — Dashboard aggregation endpoint

**Goal:** the 4 KPIs from PRD 3.2/US-02, matching Banani's `SummaryStat`
tiles.

**Files:**
- Create: `frontend/src/app/api/dashboard/route.ts` — GET, returns
  `{totalDueFcfa, debtorCount, overdueDueFcfa, recoveredThisMonthFcfa}`

`recoveredThisMonthFcfa` = sum of `PAYMENT` transactions this calendar
month for `ownerId`. Single aggregate query with `groupBy` or 2 targeted
`aggregate()` calls — no need for a materialized view at this scale
(single shopkeeper, tens of clients).

- [ ] Test the 4 numbers against seeded fixtures
- [ ] Implement
- [ ] Commit

### Phase 4 — Reproduce screens: Dashboard, Liste des débiteurs, Nouvelle dette, Paiement reçu

**Goal:** wire the 4 Banani screen types that have a 1:1 PRD match and no
open decisions (Part A.1 rows 1, 2, 3, 5, 6, 7) to Phases 1–3's API.

Use the `banani-design-implementation` skill per screen — it already knows
how to convert Banani's `@components/X` / `@global/Icon` / `t()`
conventions into this repo's actual React setup. Sequence:

1. `frontend/src/app/globals.css` — add the `@theme` block from A.6, install
   `lucide-react`, build `frontend/src/components/Icon.tsx` wrapping it
2. Build shared components first (`SummaryStat`, `DebtorRow`, `QuickAction`)
   under `frontend/src/components/jurali/` — Banani gave you their exact
   JSX in `sharedFiles`, reproduce them there instead of inline per-page
3. `frontend/src/app/page.tsx` — Dashboard (replaces the `return null`
   placeholder), fetches `/api/dashboard` + `/api/clients?sort=recent&limit=5`
4. `frontend/src/app/clients/page.tsx` — Liste des débiteurs (`DashboardAll`
   layout), search + sort by montant/ancienneté (US client-list criteria)
5. `frontend/src/app/debts/new/page.tsx` — 2-step Nouvelle dette
   (`NewDebtForm` → `NewDebtForm2`), numeric keypad, posts to
   `/api/transactions`, target < 5s / 3 taps per US-01
6. `frontend/src/app/payments/new/page.tsx` — Paiement reçu, posts
   `/api/transactions` with `type: "PAYMENT"`

Each gets its own `banani-design-implementation` pass; don't batch them —
that skill tracks progress per-screen across sessions.

- [ ] Screen 1 (Dashboard) built + smoke-tested in browser (`pnpm dev`)
- [ ] Screen 2 (Liste débiteurs) built
- [ ] Screen 3+4 (Nouvelle dette 2-step) built, confirms 3-tap flow works
- [ ] Screen 5 (Paiement reçu) built
- [ ] Commit per screen

### Phase 5 — Missing PRD screens Banani didn't return

**Blocked on:** you selecting these in Banani and re-running
`banani_get_selected_designs`.
- 3.1 Bienvenue/Inscription (shape depends on Phase 0's auth decision)
- 3.6 Fiche client (`frontend/src/app/clients/[id]/page.tsx`) — highest
  priority of the 4, it's used constantly per PRD US-04
- 3.7 Paramètres
- 3.8 Page Premium (shape depends on Phase 7 below)

### Phase 6 — Auth: phone + SMS OTP

**Decided (Phase 0): option (c).** Parallel `/api/auth/phone/*` flow,
reuses `auth.ts`'s exported primitives (JWT issuance, cookie helpers)
without touching the protected file itself. Backed by a new `PhoneOtp`
table + **Africa's Talking SMS** (user-specified 2026-08-24).

**Files (for the detailed writing-plans pass when this phase starts):**
- Modify: `frontend/prisma/schema.prisma` — `User.email` becomes optional
  (`String? @unique`), add `User.phone String? @unique`; add `PhoneOtp`
  model (`phone`, `codeHash`, `expiresAt`, `attempts`)
- Create: `frontend/src/lib/server/sms/africastalking.ts` — thin provider
  wrapper (Africa's Talking REST API, `POST /version1/messaging`), modeled
  on how `oauth/google.ts` is isolated as a single-responsibility provider
  file; own `sms/` directory since this isn't OAuth
- Create: `frontend/src/app/api/auth/phone/start/route.ts` — POST
  `{phone}`, rate-limited like signup, sends OTP via Africa's Talking,
  always 200 (no phone enumeration, same principle as email signup)
- Create: `frontend/src/app/api/auth/phone/verify/route.ts` — POST
  `{phone, code}`, verifies against `PhoneOtp`, find-or-create `User` by
  phone, issues the same JWT/CSRF cookies `auth.ts` issues today (import
  its exported cookie-setting helpers — do not reimplement JWT signing)
- Env: `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`,
  `AFRICASTALKING_SENDER_ID` (optional, shortcode/alphanumeric sender)
  added to `.env.example`, inert-if-absent per the starter's
  optional-provider convention

### Phase 7 — Abonnement Premium (10-client gate → payment)

**Goal:** PRD §4/§6, US-06 — the freemium wall + Wave/Orange Money
checkout. Bictorys is **already wired** in this starter
(`frontend/src/lib/server/payments/bictorys.ts`) — this phase is mostly
plumbing, not new integration.

**Files:**
- Modify: `frontend/prisma/schema.prisma` — add `Subscription` model
  (`ownerId`, `status: ACTIVE|CANCELED|EXPIRED`, `renewsAt`,
  `bictorysReference`)
- Create: `frontend/src/app/api/subscriptions/route.ts` — GET status, POST
  initiate checkout (reuses `PaymentProvider` interface, `bictorys.ts` as
  reference per CLAUDE.md)
- Modify: webhook handling — Bictorys webhook already exists
  (`frontend/src/lib/server/webhook/bictorys.ts`); add a `kind:
  'subscription_paid'` case that flips `Subscription.status` via the
  outbox (never inline — CLAUDE.md invariant)
- Modify: Phase 2's `POST /api/clients` limit check — `>= 10 AND no ACTIVE
  Subscription` → `409 CLIENT_LIMIT_REACHED`
- Frontend: `frontend/src/app/premium/page.tsx` (Banani's Premium screen,
  once selected in Phase 5)

### Phase 8 — Rappel WhatsApp (thin PRD version, per Phase 0 decision)

**Goal:** US-07 exactly — one button on the fiche client, one pre-written
message, `wa.me` deep link, `lastReminderSentAt` timestamp. No bulk
selection, no SMS channel, no response tracking (those are the Banani
extras flagged in A.3 — explicitly deferred, not built here).

**Files:**
- Modify: `Client` model — add `lastReminderSentAt DateTime?`
- Create: `frontend/src/app/api/clients/[id]/remind/route.ts` — POST,
  Premium-gated (`403` if not subscribed, matches US-07's "grisé avec
  mention Premium" for free users), builds the `wa.me/<phone>?text=<msg>`
  URL server-side (keeps the message template in one place), stamps
  `lastReminderSentAt`
- Frontend: button on fiche client (Phase 5) opens the returned URL

### Phase 9 (backlog, not PRD V1) — Banani's extra surfaces

Explicitly NOT built unless the user asks after seeing Phase 8 ship:
bulk WhatsApp contact selection, SMS reminder channel, reminder-response
inbox, receipt sharing to Facebook/X/email/copy-link, month-picker history
browsing, PDF export. These map to PRD's own §8 (hors-scope) or exceed it
(A.3). Worth revisiting once Jurali has real users and you know which of
these they actually ask for.

---

## Status

Phase 0 decisions resolved 2026-08-24 (see Phase 0 above). Phase 1 is
ready to execute now — no open questions block it.
