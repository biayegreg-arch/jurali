# Paramètres — Banani → Next.js/Tailwind

## Source
- Banani screen ID: `PgSudpjSlhG0/screens/Parametres.jsx`
- Fetched: 2026-08-24 (Phase 5)
- `screenSize: 'desktop'` — same sidebar layout as Fiche client.

## System context
This project already has a generic `/settings` page (`frontend/src/app/settings/page.tsx`, izikit starter) wired to real endpoints: `PUT /api/auth/change-password`, `POST /api/auth/set-password` (OAuth-only accounts), Google OAuth link, `POST /api/auth/logout`. This phase **restyles that page** in Jurali's Banani design rather than building a parallel route — same URL (`/settings`), same logic, new look, reorganized into Banani's section groupings.

## Component breakdown
- **REUSE** existing password/OAuth-link logic from the current `settings/page.tsx` verbatim (just re-skinned)
- **REUSE** `Icon`
- **NEW** `SettingsSection` + `SettingsRow` — thin presentational wrappers matching Banani's `Section`/`SettingRow`, but without the fake `toggle`/`value` props for rows with no backend (see Decisions)

## Responsive plan
- **375px (base)**: single column, sections stacked (Profil, Sécurité — Données/Langue omitted, see Decisions).
- **lg (1024px+)**: reproduces Banani's 2-column body (left: Profil; right: Sécurité) inside the same sidebar shell used by Fiche client.

## Decisions (2026-08-24, same "no fake UI" precedent as fiche-client.md — no separate AskUserQuestion round)
- **Profil & Boutique** — kept, but trimmed to real data only: email (read-only) + name if set. "Nom de la boutique" / "Adresse" / "Téléphone" rows OMITTED — no such fields exist on `User` yet (phone is reserved for Phase 6's auth work; adding shop-identity fields now would pre-empt/duplicate that phase). No "Modifier" button (no `PATCH /api/auth/me` exists).
- **Notifications & Rappels** — entire section OMITTED. Push notifications toggle is explicitly HORS SCOPE (PRD §8, already noted A.7). WhatsApp auto-reminders are Phase 8, not built — a toggle with no backend effect is exactly the "half-finished implementation" pattern to avoid.
- **Sécurité** — kept: Mot de passe (real, reuses `change-password`/`set-password`), Se déconnecter (real, `logout`). "Verrouillage par PIN" row OMITTED — Banani's PIN concept (app-open lock) is unrelated to this starter's existing `withdrawalPinHash` (a different feature, withdrawal-specific); building a new PIN system is out of scope.
- **Données** — entire section OMITTED. Export CSV/PDF is Phase 9 backlog; "Supprimer toutes les données" (account deletion) has no backend and is too destructive to stub.
- **Langue & Devise** — kept as **static, non-interactive** info rows only (Français / FCFA) — no chevron, no toggle, communicates the real (fixed) state honestly instead of implying a working switcher (language switcher is HORS SCOPE per PRD §8).
- **Comptes liés (Google)** section from the existing generic settings page — kept, re-skinned into the Banani section style; it's real, working functionality already shipped by the starter.
- **App info footer** ("Jurali · Version…") — kept as static branding, no "Voir les nouveautés" link (no changelog page exists).

## Implementation checklist
- [x] `SettingsSection` / `SettingsRow` components
- [x] Rewrite `frontend/src/app/settings/page.tsx` in Jurali styling, same logic
- [x] 375 / 1024+ layout check
- [x] Lint / typecheck / build

## UPDATE 2026-08-26 (desktop redesign, `Parametres.jsx` re-fetched)

User re-selected the "Paramètres" screen in Banani and asked for a real
desktop implementation, plus flagged a duplicate `/settings` link bug in
`DesktopSidebar` (the identity-block avatar AND a separate nav-list
"Paramètres" item both linked there — kept the identity-block link,
removed the nav-list duplicate, added active-state highlighting to the
survivor). Companion batched `AskUserQuestion` round (all answered
"Recommandé"), superseding several 2026-08-24 decisions above:

- **Profil & Boutique** — no longer read-only. Added `User.address`
  (migration `20260826004810_jurali_settings_phase9`, alongside the new
  `overdueAlertsEnabled` toggle below) and a real editing flow:
  `PATCH /api/auth/me` (name/shopName/phone/address all independently
  optional, phone-uniqueness-on-edit check excluding self →
  409 `PHONE_ALREADY_EXISTS`). Supersedes the 2026-08-24 "no `PATCH`
  exists, rows omitted" note above — the section now shows and edits
  Email (read-only), Nom de la boutique, Adresse, Téléphone.
- **Notifications & Rappels** — no longer omitted wholesale. Kept the
  existing WhatsApp auto-reminder toggle (Phase 8/9, `/api/settings/
  auto-reminders`) and added a genuinely NEW, distinct toggle:
  "Notifications dettes en retard" — a once-a-day per-user digest for
  clients overdue 14+ days (`OVERDUE_ALERT_THRESHOLD_DAYS`, distinct from
  the 7-day per-client `AUTO_REMINDER_THRESHOLD_DAYS`), wired to new
  `GET/PATCH /api/settings/overdue-alerts` + `User.overdueAlertsEnabled`
  + a new `0 8 * * *` cron (`api/cron/overdue-alerts/`, mirrors
  `cron/auto-reminders/` but aggregates per USER not per client) +
  `overdueAlertDue()` notification template. `vercel.json` and its shape
  test (`vercel-json-shape.test.ts`) updated 7→8 crons. Also added a
  static, read-only "Délai de rappel par défaut: 7 jours" row (the real
  constant, not editable — no per-user override exists). Banani's
  "Notifications push" row DROPPED — no push provider is configured
  (same reasoning as the original 2026-08-24 decision, just re-confirmed).
- **Sécurité** — unchanged in substance (password form, Google link,
  logout kept exactly as before); the desktop mock's "Verrouillage par
  PIN" app-lock and a fabricated "dernière modification" password date
  were both DROPPED — same "no fake data"/"no PIN system" reasoning as
  2026-08-24, re-confirmed rather than silently re-litigated.
- **Données** — no longer omitted wholesale. Added a real, Premium-gated
  "Exporter toutes les dettes" button: `GET /api/clients/export`
  (flattens every client's transactions for the owner, Premium-gated like
  `/api/stats`) + new `lib/jurali-csv.ts` (`buildDebtsCsv`/
  `downloadDebtsCsv` — client-side CSV generation with a UTF-8 BOM for
  Excel, same "no server-side file generation" pattern as the existing
  PDF export). Banani's "Synchronisation" row DROPPED (no offline/sync
  concept exists in this architecture) and "Supprimer toutes les données"
  (account deletion) explicitly DEFERRED — no backend exists and it's too
  destructive to stub.
- **Desktop layout** — full 2-column `DesktopSidebar` + `NotificationBell`
  layout reproducing Banani's `Parametres.jsx` (left: Profil & Boutique,
  Notifications & Rappels; right, 400px: Sécurité, Données, Langue &
  Devise, app info), sharing the same section components between the
  mobile single-column tree and the desktop tree. The two Premium toggles'
  `useApi` fetches are hoisted to a `usePremiumToggle` hook called ONCE
  per toggle in the page-level component (not inside the presentational
  `ToggleRow`), avoiding the duplicate-fetch bug that would occur from
  mounting the same data-fetching hook in both the mobile and desktop
  trees simultaneously.
