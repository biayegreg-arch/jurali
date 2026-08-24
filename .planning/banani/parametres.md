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
- [ ] `SettingsSection` / `SettingsRow` components
- [ ] Rewrite `frontend/src/app/settings/page.tsx` in Jurali styling, same logic
- [ ] 375 / 1024+ layout check
- [ ] Lint / typecheck / build
