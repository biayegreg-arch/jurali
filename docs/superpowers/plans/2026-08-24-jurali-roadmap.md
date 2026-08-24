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

### A.2 — Screens the PRD requires that Banani did NOT return (RESOLVED 2026-08-24)

~~These 4 screens are core to the PRD (3.1, 3.6, 3.7, 3.8) but weren't in the
selection you pulled~~ — a second Banani batch (8 screens: `Inscription`,
`FicheClient`, `Parametres`, `PagePremium` + 4 desktop variants of
already-covered screens) closed this gap. See A.7 below — closing this gap
opened a bigger one: the actual designs contradict several PRD statements,
most importantly auth (A.5 is now **reopened**, not resolved).

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

### A.5 — The one real architectural collision: auth (REOPENED 2026-08-24 — see A.7)

- **PRD** (3.1, US-08): phone number + SMS OTP code, **no password, no
  email**, session persists indefinitely.
- **Starter's `auth.ts`** (protected/battle-tested, CLAUDE.md forbids
  editing without explicit confirmation): `User.email` is `@unique`
  required, signup is email+password with an 8-char verification code sent
  presumably via email (Resend), refresh/access JWT pair, CSRF, the whole
  enumeration-resistant flow.
- **Banani's actual `Inscription.jsx` design** (A.7): neither of the above.
  A classic form — Nom complet, Téléphone (`+221`, labelled "utilisé pour
  les rappels WhatsApp", i.e. NOT the login credential), Nom de la boutique,
  **Mot de passe** (masked `••••••••`), terms checkbox, "Créer mon compte",
  "Déjà un compte ? Se connecter". `Parametres.jsx`'s Sécurité section also
  has a "Mot de passe — dernière modification il y a 3 mois" row. The
  designer built password auth with phone as a profile/contact field, not
  as the OTP-verified login identifier the PRD's prose describes.

Phase 0's "option (c), Africa's Talking OTP" decision was made from the PRD
text alone, before this screen existed in the fetched set. It's now
contradicted by the actual design. **Re-decide before Phase 6 starts** —
see the amendment decision below.

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

### A.7 — Amendment (2026-08-24, second Banani batch: 8 screens)

You selected `Inscription`, `FicheClient`, `Parametres`, `PagePremium` (the
4 screens A.2 flagged as missing) plus 4 desktop variants of already-covered
screens (`DashboardDesktopWithMonthPicker`, `DebtorListDesktop`,
`NewDebtDesktop`, `PaymentReceivedDesktop`). This closes A.2, but the actual
content diverges from the PRD in more places than just auth:

| Design element | Where | PRD says | Divergence |
|---|---|---|---|
| Password field | `Inscription`, `Parametres` | No password (3.1, US-08) | See A.5 — needs a decision |
| **Automatic** WhatsApp reminder, 7 days after debt creation, toggle right on the Nouvelle-dette form + a recurring "Prochain rappel" card on the fiche client | `NewDebtDesktop`, `FicheClient`, `Parametres` ("Rappels WhatsApp automatiques — Envoyer un rappel 7 jours après la dette") | US-07: **manual**, one button, one client, boutiquier-triggered | Phase 0's "PRD-thin reminders" decision assumed manual-only; this is a scheduled/cron feature (closer to Phase 9's scope than Phase 8's) |
| `address` field on client (`Médina, Dakar`), "Cliente depuis jan. 2023", "Fidèle" loyalty badge | `FicheClient` | Not in PRD; `Client` model (Phase 1) has no address | Small schema addition if wanted — not blocking, can default to null/hidden |
| Per-debt `Statut` column (Payée / En retard) in the history table, "Marquer les dettes en retard comme payées" bulk action | `FicheClient`, `DebtorListDesktop` | PRD only describes an aggregate solde, no per-debt status | Phase 1's FIFO balance model (global aging) still answers "is this client overdue"; a per-row Payée/En retard status is a display derivation (is this specific debt older than the client's paid-off point in FIFO order), not a new stored column — no schema change needed, just a Phase 4 display computation |
| Printable/shareable receipt (Reçu de collecte, Imprimer/PDF/Partager) | `PaymentReceivedDesktop` | 3.4 only says "voir le solde restant mis à jour" | Confirms A.3's flagged receipt-sharing surface is core UX in the actual design, not a Banani-only embellishment — worth reconsidering for Phase 4/8 scope, still recommend starting without it and adding once Phase 4 ships |
| "Statistiques" as a persistent nav item on every screen | all 8 | PRD §8: "Rapports et analytics avancés" explicitly HORS SCOPE | No screen designed for it yet (just a nav link) — leave as a disabled/placeholder nav entry until specced, don't build a stats backend speculatively |
| Premium: annual price (25 000 FCFA/an, "économise 2 mois"), 14-day free trial ("sans carte bancaire"), "Statistiques avancées" as a Premium perk | `PagePremium` | PRD §6: monthly only (2 500 FCFA/mois); §9 mentions "premier mois gratuit aux 50 premiers" as a manual growth tactic, not a systematic trial | Phase 7 should decide: ship monthly-only first (matches PRD's revenue model exactly) and treat annual+trial as a fast-follow, since a trial changes the Subscription state machine (needs a TRIALING status) |
| Push notifications toggle, language switcher (Français only, but the row exists) | `Parametres` | PRD §8: both explicitly HORS SCOPE V1 | Phase 5 (Paramètres screen) should omit these controls or render them disabled, not wire them to real functionality |
| Quick-amount buttons (500 / 1 000 / 10 000 / 25 000 FCFA) on Nouvelle dette | `NewDebtDesktop` | Not in PRD, pure UX nicety | Cheap to add in Phase 4, no backend impact |

None of this blocks Phase 1–4 (already built or unambiguous). It reshapes
Phase 5 (Paramètres now has a concrete design to reproduce, minus the
hors-scope toggles), Phase 6 (auth strategy — needs re-deciding), Phase 7
(Premium pricing — recommend monthly-only V1, annual+trial as fast-follow),
and Phase 8 (reminder scope — recommend keeping manual-only for V1 even
though the design shows automatic; scheduled reminders need a cron route
and a "send WhatsApp automatically without the shopkeeper's explicit
each-time consent" product/legal call that's bigger than this session).

---

## Part B — Phased roadmap

Each phase produces working, demoable software. Order matters: B1 unblocks
everything else.

### Phase 0 — Decisions

1. **Auth strategy: (c-revised) phone + password — RE-DECIDED 2026-08-24.**
   Follows `Inscription.jsx` (A.5/A.7) over the PRD's OTP prose: `User.email`
   becomes optional, add `User.phone String? @unique`, `passwordHash` stays
   required. Reuses `auth.ts`'s existing bcrypt hashing and JWT issuance —
   just a different unique lookup field, no new SMS provider needed for
   login. Africa's Talking (user-specified 2026-08-24) is reserved for a
   possible Phase 9 SMS reminder channel, not used in Phase 6.
2. **Reminder scope: PRD-thin version — RECONFIRMED 2026-08-24 despite
   `NewDebtDesktop`/`FicheClient`/`Parametres` showing automatic 7-day
   WhatsApp reminders.** Automatic reminders need a cron route (new
   surface), a per-client "reminder enabled + delay" setting, and a
   product/legal call about sending WhatsApp messages without the
   shopkeeper re-confirming each time — bigger than a V1 slice. Phase 8
   still ships US-07's manual button; automatic scheduling moves to Phase 9
   backlog alongside the other Banani extras (A.3).
3. **Premium pricing: monthly-only V1 — RECONFIRMED 2026-08-24** despite
   `PagePremium.jsx` showing monthly + annual + a 14-day no-card trial
   (A.7). Matches PRD §6's revenue model exactly; annual pricing and a
   free trial (needs a `TRIALING` Subscription status) become fast-follows
   once monthly billing is proven in Phase 7.

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

### Phase 5 — Missing PRD screens (UNBLOCKED 2026-08-24)

**No longer blocked** — the second Banani batch delivered all 4:
- 3.1 Bienvenue/Inscription (`Inscription.jsx`) — shape now known, see A.5/A.7;
  exact form fields depend on Phase 0's auth re-decision
- 3.6 Fiche client (`FicheClient.jsx` → `frontend/src/app/clients/[id]/page.tsx`)
  — highest priority of the 4, used constantly per PRD US-04. Ready to build
  against Phase 2's `GET /api/clients/[id]` as-is; the "Prochain rappel"
  auto-reminder card and per-debt Statut filter chips (A.7) render but stay
  inert/manual until Phase 8/9 backs them
- 3.7 Paramètres (`Parametres.jsx`) — build the Profil/Sécurité/Données/
  Langue sections; omit or disable the push-notifications toggle and the
  language switcher (A.7 — both HORS SCOPE per PRD §8)
- 3.8 Page Premium (`PagePremium.jsx`) — shape depends on Phase 7's pricing
  decision (monthly-only V1 vs. the design's monthly+annual+trial)

### Phase 6 — Auth: phone + password (DECIDED 2026-08-24, see Phase 0.1)

Follows `Inscription.jsx` over the PRD's OTP prose (A.5/A.7). No SMS
provider needed — Africa's Talking stays reserved for a possible Phase 9
SMS reminder channel, not used here.

**Files:**
- Modify: `frontend/prisma/schema.prisma` — `User.email` becomes optional
  (`String? @unique`), add `User.phone String? @unique`; `passwordHash`
  stays required for this flow (already exists on `User`)
- Create: `frontend/src/app/api/auth/phone-signup/route.ts` — POST
  `{name, phone, shopName, password}`, hashes password the same way
  email signup does (reuse `auth.ts`'s exported bcrypt helper, don't
  reimplement), find-or-fail on existing phone, issues the same
  JWT/CSRF cookies `auth.ts` issues today
- Create: `frontend/src/app/api/auth/phone-login/route.ts` — POST
  `{phone, password}`, same enumeration-resistant timing floor pattern
  as the existing email login route

### Phase 7 — Abonnement Premium (10-client gate → payment)

**Goal:** PRD §4/§6, US-06 — the freemium wall + Wave/Orange Money
checkout. Bictorys is **already wired** in this starter
(`frontend/src/lib/server/payments/bictorys.ts`) — this phase is mostly
plumbing, not new integration.

**Pricing: monthly-only V1 (DECIDED 2026-08-24, see Phase 0.3).**
`PagePremium.jsx` shows monthly (2 500 FCFA), annual (25 000 FCFA), and a
14-day no-card free trial (A.7) — annual + trial deferred as fast-follows
once monthly billing is proven; the `Subscription` model below ships
without a `TRIALING` status for now.

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

- Phase 1 (domain model) — **done**, committed `c7264ba`.
- Phase 2 (`/api/clients` + `/api/transactions`) — **done**, committed `17b0ea4`.
- Phase 3 (dashboard endpoint) — **done**, committed `0c4e06d`.
- Phase 4 (reproduce Dashboard, Liste des débiteurs, Nouvelle dette,
  Paiement reçu) — **done**, committed `52bce00`.
- Phase 0.1 (auth strategy) — **re-decided 2026-08-24**: phone + password
  (c-revised), following `Inscription.jsx` over the PRD's OTP prose.
- Phase 5 (missing PRD screens) — **done 2026-08-24**: Fiche client +
  Paramètres (`eab4b15`), Inscription + companion `/login` (`098bcbc`,
  no Banani source for `/login` — needed so `useUser()`'s app-wide
  redirect target and Inscription's own "Se connecter" link both
  resolve to something real), Page Premium + companions `/premium/
  {success,failed}` (Phase 7, see below). See `.planning/banani/STATUS.md`.
- Phase 6 (auth: phone + password) — **done 2026-08-24**, committed
  `a45777b`. `User.email` was kept required rather than made optional as
  originally planned — see the "Email nullable?" decision below.
  `/api/auth/phone-signup` and `/api/auth/phone-login` built, TDD (13
  tests), verified end-to-end against the dev DB.
  - **Decision (2026-08-24): `User.email` stays required.** The
    original Phase 6 plan called for making it optional. Implementation
    surfaced a conflict: `auth.ts`'s `TokenPayload`/`Context` (both
    protected files) require `email: string`. Rather than modify those
    protected files, phone-only accounts get a synthetic,
    non-deliverable placeholder email (`<phone>@phone.jurali.local`) —
    confirmed with the user before editing the schema.
  - **Divergence from email signup:** phone-signup is NOT
    enumeration-resistant (409 `PHONE_ALREADY_EXISTS` on a duplicate
    phone, not email signup's identical-201 pattern) — this was already
    the plan's own wording ("find-or-fail on existing phone") from the
    A.5/A.7 analysis of `Inscription.jsx`.
  - phone-login skips the `emailVerifiedAt` check entirely (no email is
    ever collected for phone accounts, so there's nothing to verify).
- Phase 7 (Premium subscription) — **done 2026-08-24**, committed
  `75dc660`. Pricing **decided 2026-08-24**: monthly-only
  V1, annual + trial deferred (dropped from the built `/premium` page
  too — see `.planning/banani/page-premium.md`).
  - `Subscription` model added (`ownerId @unique` — one row reused
    across renewals, not a row-per-period ledger). "Active" is always a
    live `status === 'ACTIVE' && renewsAt > now` computation
    (`lib/server/subscriptions/guards.ts`), never trusted from `status`
    alone — no expiration cron needed to keep the free-tier gate correct.
  - `GET/POST /api/subscriptions` reuses the Orders' CircuitBreaker +
    lazy-provider-init + PUBLIC_URL fail-closed pattern, but replay
    protection comes from `ownerId`'s uniqueness rather than a
    client-supplied Idempotency-Key header (Subscription is one
    reused row, not one row per purchase attempt like Order).
  - **Divergence from the original plan's "`kind: 'subscription_paid'`
    case":** that phrasing doesn't map to anything real — the webhook
    factory's `kind` (`paid`/`refunded`/`failed`) is provider-reported,
    not domain-specific. The actual fix: `/api/webhooks/bictorys`'s
    existing `onPaid`/`onFailed`/`onRefunded` handlers now ALSO check
    `Subscription.providerChargeId` when no `Order` matches — no new
    outbox event kind needed (would require editing the PROTECTED
    `outbox/dispatcher.ts`; skipped for subscription events, same
    reasoning already established there for refund notifications).
  - `POST /api/clients`'s 10-client free-tier cap now waives for a user
    with `isSubscriptionActive(subscription) === true`.
  - TDD throughout (8 guard tests, 13 `/api/subscriptions` tests, 4 new
    webhook-correlation tests, 2 new clients-gate tests). Verified
    end-to-end against the dev DB: signup → 10-client cap → 409 →
    Subscription activated (simulating the webhook, since
    `BICTORYS_*` is unconfigured in this dev environment) → cap
    bypassed → `ALREADY_SUBSCRIBED` on re-checkout → all 3 `/premium*`
    pages render cleanly.
- Landing page (before Phase 8, ad hoc per user request 2026-08-24) —
  **done 2026-08-24**, committed `87f2bb3`. Built from
  Banani's `LandingPage.jsx` — see `.planning/banani/landing-page.md`.
  - **Routing decision:** `/` now serves the public landing page instead
    of the Dashboard; the Dashboard moved to `/dashboard`. Not explicitly
    spelled out by the user, but implied by their own instruction ("quand
    je clique le logo de Jurali [depuis /login], il me retourne sur le
    landing page") — a logo click returning to a marketing page only
    makes sense if that page is the site's public home. All 8
    `href="/"` / `router.push('/')` call sites that meant "back to
    dashboard" were repointed to `/dashboard`; `/auth/error`'s "Accueil"
    link correctly kept pointing at `/` (an unauthenticated visitor
    landing there belongs on the marketing page, not a dashboard they
    can't reach). `/login` and `/signup`'s wordmarks are now
    `<Link href="/">`, satisfying the user's request.
  - **Copy fixes** (same bar as Phase 7's `/premium` fixes — trial/annual
    language contradicts the Phase 0.3 monthly-only decision): hero and
    pricing CTAs referencing a 14-day trial changed to
    "Commencer gratuitement"/"Commencer" (true — the free tier has no
    card requirement); "Annule quand tu veux" dropped (no
    cancel-subscription endpoint exists anywhere in the app yet — would
    have been a functional false claim).
  - **Dead-link cleanup:** nav/footer links with no real destination
    ("À propos", "Nous contacter", FAQ, Blog, Mentions légales, CGU,
    Politique de confidentialité — no pages or contact channel exist)
    were dropped rather than shipped as inert. "Fonctionnalités"/"Tarif"
    became real in-page anchors; "Voir la démo" repointed to the Product
    section anchor instead of a nonexistent demo. Footer's dropped
    Contact/Légal columns replaced with a real "Compte" column
    (Se connecter/Créer un compte).
  - Stats band (traction numbers) and testimonials kept as-is — same
    aspirational-marketing-copy bar already applied to `/premium`'s
    feature list and testimonials in Phase 7 (no interactive control
    claims them as functional).
  - Verified: typecheck/lint/format/build clean; full suite 660/661
    (1 pre-existing bcrypt-timeout flake in `signup/route.test.ts`,
    confirmed unrelated — passes clean in isolation, same category as
    prior phases); functional curl check against a live dev server
    confirmed `/` renders the landing page with working CTAs/anchors and
    no dead links, `/dashboard` still renders the dashboard shell, and
    both `/login`/`/signup` wordmarks resolve to `<a href="/">`.
- Phase 8 (Rappel WhatsApp, US-07 thin PRD version) — **done 2026-08-24**,
  committed `ae55c70`. See `.planning/banani/
  phase8-reminder.md` for the full US-07 acceptance-criteria mapping.
  - `Client.lastReminderSentAt` added (migration
    `20260824194357_jurali_reminder`). `lib/server/jurali/reminder.ts`
    (TDD, 7 tests) builds the pre-written French message
    (prénom + montant + nom de la boutique) and the `wa.me` deep link in
    one place.
  - `POST /api/clients/[id]/remind` — Premium-gated
    (`isSubscriptionActive`, 403 `PREMIUM_REQUIRED`), 404
    `CLIENT_NOT_FOUND` (existence-leak-safe like `GET /api/clients/[id]`),
    409 `CLIENT_NO_PHONE` / `NOTHING_OWED` for the other two
    button-visibility preconditions from US-07. Stamps
    `lastReminderSentAt` optimistically at link-generation time (no
    webhook/Business API exists to confirm actual WhatsApp delivery —
    out of scope per A.3).
  - **"Peut visualiser le message avant envoi" resolved without new UI:**
    a `wa.me/<phone>?text=<msg>` link pre-fills WhatsApp's input box but
    doesn't send — the boutiquier still taps send inside WhatsApp. No
    separate preview screen was needed.
  - Frontend: the fiche-client reminder card (placed inert in Phase 5)
    is now wired for real — hidden entirely unless the client has both a
    phone and balance > 0; grayed to a real `/premium` upsell link for
    free-tier users (not a dead disabled button); functional
    "Envoyer WhatsApp" button for Premium users that opens the `wa.me`
    URL and refreshes the fiche to show the updated "dernier rappel
    envoyé le …" indicator.
  - TDD throughout (7 `reminder.ts` tests, 10 new `/remind` route tests,
    1 new `GET /api/clients/[id]` test for the added field — 680 total,
    same 1 pre-existing bcrypt-timeout flake as Phase 7's run, confirmed
    unrelated). Verified end-to-end against the dev DB: signup → client
    w/ phone + debt → 403 `PREMIUM_REQUIRED` → Subscription activated
    directly in DB (Bictorys unconfigured in dev, same technique as
    Phase 7) → 409 `CLIENT_NO_PHONE` on a phone-less client → 200 with a
    correctly-interpolated `wa.me` URL + stamped timestamp, confirmed via
    a follow-up GET → 409 `NOTHING_OWED` after an offsetting payment.
    Test data cleaned up, dev server stopped.
- Phase 9 (partial: auto-reminders + PDF export) — **done 2026-08-24**,
  committed `263ccab`. User picked 2 of the 4 backlog
  items via AskUserQuestion (bulk contact selection, SMS channel, and
  response tracking remain backlog). See `.planning/banani/phase9.md`.
  - **Auto-reminders cannot silently send** — only the paid WhatsApp
    Business API can, already ruled out (A.3). Asked the user how
    "automatique" should surface instead; chose **in-app notification**
    (reusing the starter's existing generic `Notification` system) over
    a dedicated list page. `User.autoReminderEnabled` (default **false**
    — existing users never consented) gates a new hourly
    `POST /api/cron/auto-reminders` that flags clients whose oldest
    unpaid debt is 7+ days old with no reminder sent since
    (`lib/server/jurali/auto-reminder.ts`, TDD). Deliberately NOT folded
    into `NotificationPreferences.prefs` — that JSON's D-10 contract is
    "missing ⇒ enabled" (opt-out channel preference), the inverse of
    what a default-off business-logic gate needs — got its own
    `GET/PATCH /api/settings/auto-reminders` instead.
  - `TopBar`'s bell icon — a static, inert decoration since Phase 4 — is
    now wired for real (unread badge, links to a new `/notifications`
    list). Settings gained a real "Notifications & Rappels" section
    (entirely omitted in Phase 5 for lack of backend), Premium-gated the
    same way as Phase 8's reminder card.
  - `vercel.json` now declares 7 crons; `vercel-json-shape.test.ts`'s
    hardcoded counts bumped 6 → 7 (not a protected file).
  - **PDF export**: `jspdf` added — client-side generation only, no
    server route (Vercel-serverless-first, no Puppeteer). Fiche client
    gets an "Exporter PDF" button (Premium-gated like Phase 8's reminder
    card) building a full transaction-history PDF via
    `lib/jurali-pdf.ts` (TDD — jsPDF runs fine under plain Node, so the
    actual document construction is tested).
  - `GET /api/auth/me` extended with `shopName` (needed by both the
    reminder body and the PDF header).
  - TDD throughout (9 + 8 + 6 + 7 new tests). Verified end-to-end against
    the dev DB: toggle on → backdated 9-day-old debt (direct Prisma
    insert, since the API always stamps `now()`) → Premium activated →
    cron run twice (second run confirms dedup — DB row count stays 1) →
    correct notification title/body/clientId → mark-read → count drops
    to 0. **Explicitly not verified**: the client-only interactive
    pieces (toggle visual state, PDF button's gated appearance, the
    actual click → download flow) — every page here is `'use client'`
    and renders empty on a bare curl fetch until hydration runs, and no
    browser-automation tool is available in this environment. Typecheck/
    lint/build all pass, which rules out compile errors but not runtime
    UI correctness — flagged rather than glossed over.
- Full-app audit (user request 2026-08-24: responsive integration +
  backend wiring across all 14 pages) — **done 2026-08-24**, fixes
  committed `0b6ee43`. 4 findings (1 critical: `TopBar` showing the
  synthetic phone-account email instead of `shopName`; 3 high: missing
  `max-w-2xl` desktop cap on Dashboard/Debtor-list, `/settings` never
  linked from anywhere in the app, `ClientPicker`'s prefill only
  applying on first render). All 4 fixed same day — see
  `.planning/banani/dashboard.md`, `debtor-list.md`, `new-debt.md`
  "Audit fix (2026-08-25)" sections.
- Phase 9 (month-picker remainder) — **done 2026-08-25**, uncommitted
  (pending user "commit"). User chose "Month-picker d'abord" over
  building the full remaining backlog at once; the bulk-select/SMS/
  response-tracking bundle stays deferred pending a separate decision.
  See `.planning/banani/phase9.md` § Month-picker.
  - `lib/server/jurali/month-range.ts` (TDD, 12 tests, no
    `'server-only'` marker — shared by both the route and the client
    component) + `GET /api/dashboard` extended additively with
    `?month=` support (3 new tests, 8/8 passing) + `MonthPicker.tsx` +
    `dashboard/page.tsx` wiring. Dashboard-only scope: the picker scopes
    2 new "Historique mensuel" stat cards, not the existing debtor-row
    list.
  - Full suite: 727 tests, 726 passed (1 pre-existing bcrypt-timeout
    flake in `signup/route.test.ts`, reconfirmed passing clean in
    isolation). `pnpm build` clean. Verified end-to-end against the dev
    DB: phone-signup → client with a DEBT + a PAYMENT → default month
    scoping, a past no-data month, and a malformed `?month=` param all
    returned correct values; test data cleaned up via direct Prisma
    deletion (no `DELETE /api/clients/[id]` route exists). **Not
    verified**: `MonthPicker`'s actual click-through behavior in a
    browser — same standing limitation (no browser automation
    available).
