# Phone country-code selector — no Banani source, built fresh

## Source
- No matching Banani screen — the user's attached screenshot (a "Telan"
  wellness-brand landing page) had no phone/country-selector UI in it and
  was confirmed unrelated to the request. Built fresh, mobile-first, in
  Jurali's existing visual system.

## System context
- Scope confirmed via batched question (2026-08-26): the selector applies
  to the 3 free-text client/profile phone fields — `ClientForm`
  (create/edit client) and Settings' `ProfileSection`. At that point
  `/login`/`/signup` deliberately kept their fixed "+221" split UI (the
  account's own auth-relevant phone, assumed always Senegalese).
- **UPDATE (same day, later)**: the user explicitly asked (with a
  screenshot of `/login`) for the same selector on `/login` and `/signup`
  too — an explicit reversal of the earlier scope decision, not ambiguous,
  so applied directly without re-asking. Backend has no Senegal-only
  restriction (`phone-login`/`phone-signup` both just use the generic
  `zPhone` E.164 validator), so this is a pure frontend change — verified
  live: signed up and logged back in with a `+33...` number end-to-end.
- Implementation confirmed: a hand-built Tailwind dropdown over a static
  ~166-country data file, no new npm dependency.

## Component breakdown
- **NEW** `lib/jurali-countries.ts` — `COUNTRY_DIAL_CODES` (Sénégal
  pinned first, rest alphabetical by French name), `flagEmoji(iso2)`
  (regional-indicator codepoints, no image assets), `findCountryByDialPrefix`
  (longest-dial-code-prefix match, defaults to Sénégal).
- **NEW** `components/jurali/PhoneField.tsx` — composes a single
  `+<dialCode><localDigits>` string (or `''` when empty) so it drops into
  `ClientFormValues.phone` / Settings' `phone` state / login+signup's own
  `phone` state unchanged. `compact` controls sizing (Settings' tighter
  boxes vs. everyone else's roomy ones), `showLabel` independently controls
  whether the field renders its own label (off for Settings and for
  login/signup, which already render their own outer `<label>`). Reuses
  `ClientPicker`'s outside-click-to-close pattern for the dropdown.
- **FIXED (same day)**: the selected country was derived purely from the
  composed value string, so picking a country before typing any digits was
  silently discarded (the composed value stays `''` while empty, which
  re-parses back to Sénégal). Now tracked as its own local state, only
  re-synced from an external non-empty value (e.g. loading an existing
  client's stored international number).
- **REMOVED** `lib/jurali-phone.ts` (`normalizePhoneInput`) — the prior
  turn's heuristic "guess +221 for a bare local number" band-aid is now
  superseded by an explicit country choice; dead code once `PhoneField`
  replaced its 3 call sites.
- **REUSE** `ClientForm.tsx`'s existing `Field` component for the other 3
  fields (name/email/address) — unchanged.

## Interactions / state
- Dropdown: click-to-open, outside-click-to-close, live search by country
  name or dial code, no keyboard nav beyond default tab order (matches
  `ClientPicker`'s existing bar).
- Selecting a new country re-composes the value using the CURRENT local
  digits (doesn't clear what the user already typed).
- Clearing the local digits back to empty produces `''`, not `+221` —
  matches the server's `z.union([zPhone, z.literal('')])` optional-phone
  contract.

## Implementation checklist
- [x] `lib/jurali-countries.ts` (+ `jurali-countries.test.ts`)
- [x] `components/jurali/PhoneField.tsx`
- [x] Wired into `ClientForm.tsx` (create + edit), Settings'
      `ProfileSection`, `/login`, `/signup`
- [x] Removed `jurali-phone.ts`/`.test.ts` (dead code)
- [x] Fixed country-selection-discarded-before-typing bug
- [x] Lint / typecheck / test / build
- [x] Live-verified against dev server: client create+fetch round-trip
      AND signup+login round-trip, both with a non-Senegal (+33...) number

## Open questions for user
(none — both decisions confirmed via batched question before coding)
