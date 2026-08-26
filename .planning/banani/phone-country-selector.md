# Phone country-code selector — no Banani source, built fresh

## Source
- No matching Banani screen — the user's attached screenshot (a "Telan"
  wellness-brand landing page) had no phone/country-selector UI in it and
  was confirmed unrelated to the request. Built fresh, mobile-first, in
  Jurali's existing visual system.

## System context
- Scope confirmed via batched question (2026-08-26): the selector applies
  to the 3 free-text client/profile phone fields only —
  `ClientForm` (create/edit client) and Settings' `ProfileSection`.
  `/login` and `/signup` deliberately keep their fixed "+221" split UI —
  that phone is the account's own auth-relevant number, always Senegalese
  by design, unrelated to a client's country.
- Implementation confirmed: a hand-built Tailwind dropdown over a static
  ~166-country data file, no new npm dependency.

## Component breakdown
- **NEW** `lib/jurali-countries.ts` — `COUNTRY_DIAL_CODES` (Sénégal
  pinned first, rest alphabetical by French name), `flagEmoji(iso2)`
  (regional-indicator codepoints, no image assets), `findCountryByDialPrefix`
  (longest-dial-code-prefix match, defaults to Sénégal).
- **NEW** `components/jurali/PhoneField.tsx` — composes a single
  `+<dialCode><localDigits>` string (or `''` when empty) so it drops into
  `ClientFormValues.phone` / Settings' `phone` state unchanged. `compact`
  prop switches between `ClientForm`'s roomy labeled style and Settings'
  tighter unlabeled inline-form style. Reuses `ClientPicker`'s
  outside-click-to-close pattern for the dropdown.
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
- [x] Wired into `ClientForm.tsx` (create + edit) and Settings'
      `ProfileSection`
- [x] Removed `jurali-phone.ts`/`.test.ts` (dead code)
- [x] Lint / typecheck / test / build
- [x] Live-verified against dev server: create + fetch round-trip with a
      non-Senegal number (+33...) preserved exactly

## Open questions for user
(none — both decisions confirmed via batched question before coding)
