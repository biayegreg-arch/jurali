# Landing Page — Banani → Next.js

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/LandingPage.jsx`
- Fetched: 2026-08-24

## Routing decision (not in the Banani design, resolved here)

The user's instruction ("quand je suis sur la page de connexion dès que je
clique le logo de Jurali, il me retourne sur le landing page") implies the
landing page is the app's public home — the natural destination a logo click
returns to. CLAUDE.md frames `src/app/page.tsx` as "your homepage... no
layout assumption baked into the API," so:

- **`/` becomes the new public landing page** (this screen).
- **The current Dashboard moves from `/` to `/dashboard`.** `useUser()`
  already redirects unauthenticated visitors to `/login` by default, so no
  behavior changes for the dashboard itself — only its URL.
- All 7 files that had `href="/"` assuming "go to dashboard" are repointed to
  `/dashboard`: `auth/error/page.tsx`, `debts/new/page.tsx`,
  `settings/page.tsx`, `payments/new/page.tsx`, `premium/page.tsx`,
  `premium/success/page.tsx`, `premium/failed/page.tsx`. Same for the 3
  `router.push('/')` call sites (`signup`, `login`, `debts/new` — post-action
  redirects) → `router.push('/dashboard')`.
- `/login` and `/signup`'s Jurali wordmark becomes `<Link href="/">` (the new
  landing page) per the user's explicit ask.
- No auto-redirect of an already-authenticated visitor away from `/` — kept
  simple; a logged-in shopkeeper landing on `/` still sees the marketing
  page and can navigate to `/dashboard` via the header ("Démarrer"/logo is
  fine to leave pointing at `/signup` since a logged-in user hitting signup
  will just get redirected forward by that page's own logic — not verified
  here, low-stakes edge case, not worth blocking on).

## Structure map
- Header/nav — sticky, logo + 4 nav links + Se connecter/Démarrer buttons
- Hero — headline, subcopy, 2 CTAs, sticky-scroll target for anchors
- Hero image placeholder — decorative, kept as-is (no real screenshot asset)
- Problem/Solution — 3-col cards, static content, no fix needed
- Features — 6-item dark (bg-primary) section, static content
- Product section — 2-col, image placeholder + checklist, static
- Stats band — 4-col numbers, kept as marketing copy (same bar as /premium's
  testimonials — aspirational, no interactive control claims it)
- Testimonials — 3-col, avatars replaced with initials-circle (matches the
  existing /premium testimonial pattern; Banani's `@global/UserAvatar` import
  doesn't exist in this codebase)
- Pricing — 2-col Free/Premium, duplicates /premium's pricing cards
- Final CTA section
- Footer — 4-col, mostly inert links in the Banani source

## Component breakdown
- **NEW** `src/app/page.tsx` — the landing page (replaces the old Dashboard)
- **REUSE** `Icon` (`@/components/jurali/Icon`) — all icons already resolve
  (`alert-circle`/`bar-chart-2` already aliased in RENAMED from earlier
  phases; verified rest against installed lucide-react version)
- No new shared component needed — this screen doesn't reuse
  Dashboard/TopBar/etc., it's public/unauthenticated

## Token mapping
Identical `@theme` tokens already ported in Phase 4 (`--color-primary`
#1E5C3A, `--color-accent` #E8A020, DM Sans/Space Grotesk, etc.) — no new
tokens needed, Banani's `sharedFiles/style.css` for this screen matches the
project's `globals.css` exactly.

## Decisions (copy/interaction fixes — documented, not asked, per this
session's established "pure technical/consistency correction" bar)

1. **Trial language removed.** "Essai gratuit 14 jours" (hero CTA) and
   "Essai 14 jours gratuit" (pricing Premium CTA) reference a trial
   mechanism that doesn't exist (Phase 0.3: monthly-only, no trial/annual —
   already enforced identically on `/premium`). Hero CTA becomes
   "Commencer gratuitement" → `/signup` (true: the free tier has no card
   requirement). Pricing Premium CTA becomes "Commencer" → `/signup` (an
   anonymous visitor must create an account before subscribing; the actual
   Premium checkout only happens on the authenticated `/premium` page).
   Hero subtext "Sans carte bancaire · Annule quand tu veux" → "Annule quand
   tu veux" dropped (no cancel-subscription endpoint exists anywhere in the
   app today — would be a functional false claim); kept "Sans carte
   bancaire pour démarrer" (true).
2. **"Voir la démo" button** had no demo asset/page to link to. Rather than
   ship an inert button (banned) or invent a fake demo, it's repointed as a
   real in-page anchor scroll to the Product section (`#produit`), which
   does show what the product looks like. Functions as intended, not fake.
3. **Header nav links** — only 2 of 4 have real destinations in this build:
   "Fonctionnalités" → anchor `#fonctionnalites`, "Tarif" → anchor `#tarif`.
   "À propos" and "Nous contacter" dropped — no about-page content and no
   real contact channel (no support email/phone found anywhere in the repo
   — grepped `.env.example` + `src/lib/server/notifications`, nothing);
   inventing one would be worse than omitting it.
4. **Footer** — same reasoning as #3. Kept: brand blurb, "Produit" column
   (Fonctionnalités/Tarif anchors — dropped FAQ/Blog, no pages exist). Legal
   column (Mentions légales/CGU/Politique de confidentialité) and Contact
   column (Nous contacter/Support/Email) dropped entirely — none of those
   pages/channels exist; a dead legal-page link is worse than no link.
   Replaced with a "Compte" column: Se connecter → `/login`, Créer un
   compte → `/signup` — real, useful, honest.
5. **Testimonials avatars** — Banani's `@global/UserAvatar` isn't a real
   import in this project. Replaced with the initials-in-a-circle pattern
   already shipped on `/premium`'s testimonials block, for consistency.
6. **Stats band + testimonials copy** kept as-is (aspirational marketing
   copy, same bar already applied to `/premium`'s feature list and
   testimonials in Phase 7 — no interactive control claims these are true,
   and this is a pre-launch landing page pattern).

## Responsive plan
- **Base (375px)**: header collapses to logo + Se connecter/Démarrer only
  (nav links hidden — `hidden md:flex`); hero stacks single-column,
  full-width CTA buttons; problem/solution, features, product, pricing,
  testimonials grids all collapse to `grid-cols-1`; stats band becomes
  `grid-cols-2` (4 numbers in a 2x2, not 1 column — stays legible); footer
  collapses to single column.
- **md (768px+)**: nav links appear; problem/solution → `md:grid-cols-3`;
  features → `md:grid-cols-2`; footer → `md:grid-cols-4`.
- **lg (1024px+)**: pricing/testimonials → `lg:grid-cols-2`/`lg:grid-cols-3`;
  product section → `lg:flex-row`; stats → `lg:grid-cols-4`. This matches
  Banani's desktop mockup.

## Copy / i18n
All strings are already French in the Banani source (this app has no i18n
layer — French is the only language, matching every other screen).

## Implementation checklist
- [x] Move Dashboard `src/app/page.tsx` → `src/app/dashboard/page.tsx`
- [x] Build `src/app/page.tsx` as the landing page (mobile-first)
- [x] Update 7 `href="/"` + 3 `router.push('/')` references → `/dashboard`
- [x] `/login` + `/signup` wordmarks → `<Link href="/">`
- [x] 375px / 768px / 1280px checks
- [x] typecheck/lint/test/build
- [x] Functional check against dev server

## Open questions for user
(none — routing decision + copy fixes documented above per the session's
established "proceed and document" bar for logical-necessity/consistency
calls; flagged here for veto if the user disagrees)
