# Sidebar "Passer à Premium" nudge — Banani → Next.js/Tailwind

## Source
- Banani screen IDs: `PgSudpjSlhG0/screens/PagePremium.jsx` (re-fetched — the
  free-tier sidebar's "Limite atteinte" upsell card, positioned right below
  the nav) and `PgSudpjSlhG0/screens/PremiumActivationSuccess.jsx` (shows
  the same sidebar with the nudge dropped once Premium is active).
- Fetched: 2026-08-26.
- User request: add a "Passer à Premium" entry below "Statistiques" in the
  desktop sidebar.

## System context
- `DesktopSidebar` ([frontend/src/components/jurali/DesktopSidebar.tsx](../../frontend/src/components/jurali/DesktopSidebar.tsx))
  is shared, unmodified, across 9 routes: `/clients`, `/dashboard`,
  `/debts/new`, `/debts/overdue`, `/stats`, `/settings`, `/clients/[id]`,
  `/clients/[id]/edit`, `/clients/new`. Confirmed with the user: the nudge
  ships on all 9, not just `/dashboard`, for consistency.
- Data: `GET /api/dashboard` gained one additive field, `totalClientCount`
  (every `Client` row regardless of balance — `summaries.length`, free).
  Deliberately NOT the same as the existing `debtorCount` (only clients with
  `balanceFcfa > 0`) — the free-tier cap in `POST /api/clients` counts ALL
  clients, so reusing `debtorCount` would under-report progress toward the
  limit. Verified live: 3 clients created, 2 with a debt →
  `totalClientCount: 3`, `debtorCount: 2`.
- The free-tier limit itself (`10`) was duplicated as a local constant
  inside `api/clients/route.ts`; extracted to
  [frontend/src/lib/server/jurali/client-limits.ts](../../frontend/src/lib/server/jurali/client-limits.ts)
  (no `server-only`, matching the existing `auto-reminder.ts` /
  `overdue-alert.ts` precedent for threshold constants shared with client
  components) so the route and the sidebar can't drift.
- `isPremium` comes from the existing `GET /api/subscriptions` `isActive`
  field, already fetched on 5 of the 9 pages (`/debts/new`, `/debts/overdue`,
  `/clients/[id]`, `/settings`, `/stats`); added the same fetch to the 4
  pages that didn't already have it (`/clients`, `/dashboard`,
  `/clients/[id]/edit`, `/clients/new`).

## Decisions (confirmed via batched question, 2026-08-26)
- **Scope**: all 9 pages using `DesktopSidebar`, not just `/dashboard`.
- **Content**: real `totalClientCount / CLIENT_FREE_TIER_LIMIT` progress bar
  + "Passer à Premium" label, not Banani's fictional "8/10" and not a bare
  CTA with no progress context.
- **Once Premium**: the whole card is hidden (`{!isPremium && (...)}`) —
  matches `PremiumActivationSuccess.jsx`'s sidebar, which drops the nudge
  entirely once the plan is active (there's no cap left to show progress
  against).

## Component breakdown
- **REUSE** `DesktopSidebar` — extended with 2 new required props
  (`totalClientCount: number`, `isPremium: boolean`), no new component
  needed. The whole card is a `<Link href="/premium">` (clickable nudge,
  satisfies "add a Passer à Premium entry" without a separate button).

## Token mapping (Banani → project)
| Banani | Project |
|---|---|
| `rgba(255,255,255,0.12)` card bg | `bg-primary-foreground/10` (existing `SidebarStat` convention) |
| `rgba(255,255,255,0.2)` progress track | `bg-primary-foreground/20` |
| `bg-accent` progress fill | `bg-accent` |
| `Icon i="alert-circle"` | swapped for `zap` — the card's headline is now "Passer à Premium" (a CTA), not "Limite atteinte" (a warning), so the icon follows the CTA framing already used elsewhere in the app (`/premium`'s hero, `ReminderCard`'s WhatsApp CTA) |

## Responsive plan
- Desktop-only (`lg:` — `DesktopSidebar` itself is `hidden lg:flex`, no
  mobile equivalent exists for this shared sidebar, consistent with every
  other element in this component).

## Interactions / state
- Progress bar width is clamped `Math.min(100, ...)` — reachable edge case:
  a user who was Premium with >10 clients whose subscription lapses would
  otherwise render a >100% bar.
- No loading/error state needed beyond the existing `dashboard`/`subscription`
  fetches' own `?? 0` / `?? false` fallbacks (same pattern as every other
  sidebar stat).

## Implementation checklist
- [x] `frontend/src/lib/server/jurali/client-limits.ts` (new)
- [x] `frontend/src/app/api/clients/route.ts` — import shared constant
- [x] `frontend/src/app/api/dashboard/route.ts` — add `totalClientCount`
- [x] `frontend/src/components/jurali/DesktopSidebar.tsx` — nudge card
- [x] Wire `totalClientCount` + `isPremium` into all 9 consumer pages
- [x] Lint / typecheck / test / build
- [x] Live-verified against dev server: `totalClientCount` diverges
      correctly from `debtorCount`

## Open questions for user
(none — all 3 decisions confirmed via batched question before coding)
