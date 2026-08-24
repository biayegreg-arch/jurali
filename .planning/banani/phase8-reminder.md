# Phase 8 — Rappel WhatsApp (US-07, thin PRD version)

No new Banani screen — this phase wires up the reminder card already
placed (inert) on `clients/[id]/page.tsx` during `fiche-client.md`
(Phase 5). Spec: roadmap "Phase 8" section + `planning_prd-jurali.md`
US-07 acceptance criteria (verbatim, since the roadmap's own Phase 8
section is a terse summary, not exhaustive):

> - Un bouton "Envoyer un rappel" est visible sur la fiche client
>   (uniquement pour les clients ayant un solde > 0 et un numéro de
>   téléphone enregistré)
> - En version gratuite, le bouton est visible mais grisé avec mention
>   "Premium"
> - Le message est pré-rédigé en français avec le prénom du client, le
>   montant dû et le nom de la boutique
> - Le boutiquier peut visualiser le message avant envoi
> - Le message est envoyé via WhatsApp (ouverture de WhatsApp avec le
>   message pré-rempli)
> - Un indicateur sur la fiche client montre la date du dernier rappel
>   envoyé

## Backend

- `Client.lastReminderSentAt DateTime?` — migration
  `20260824194357_jurali_reminder`.
- `frontend/src/lib/server/jurali/reminder.ts` — pure, TDD'd
  (`buildReminderMessage`, `buildWhatsAppReminderUrl`). Template lives in
  one place so the route and any future caller can't drift on wording.
- `POST /api/clients/[id]/remind` — Premium-gated via
  `isSubscriptionActive` (403 `PREMIUM_REQUIRED`), 404 `CLIENT_NOT_FOUND`
  (existence-leak-safe, same as `GET /api/clients/[id]`), 409
  `CLIENT_NO_PHONE` / `NOTHING_OWED` for the other two button-visibility
  preconditions. On success: builds the message + `wa.me` URL, stamps
  `lastReminderSentAt = now()`, returns both.
- `GET /api/clients/[id]` extended to return `lastReminderSentAt` (for
  the indicator).

## "Peut visualiser le message avant envoi" — resolved without new UI

A `wa.me/<phone>?text=<msg>` link opens WhatsApp with the text **pre-filled
in the input box, not sent**. The boutiquier still has to tap send inside
WhatsApp. That already satisfies "preview before send" — no separate
preview modal/screen was built. Documented here since the roadmap's Phase
8 file list doesn't mention this criterion explicitly and could read as
if it were dropped; it isn't, it's satisfied by the deep-link mechanism
itself.

## `lastReminderSentAt` is stamped optimistically

The app has no visibility into whether the boutiquier actually pressed
send inside WhatsApp after the redirect (no webhook, no Business API —
explicitly out of scope, see roadmap A.3). `lastReminderSentAt` is
therefore stamped when the link is generated, not on confirmed delivery.
Same class of tradeoff as every other client-redirect flow in this app.

## Frontend (`clients/[id]/page.tsx`)

- Reminder card only renders when `client.phone && client.balanceFcfa > 0`
  (first bullet of US-07) — hidden entirely otherwise, not grayed.
- Non-Premium: renders as a `<Link href="/premium">` styled muted with a
  "Premium" badge — a real, working upsell link rather than a dead
  disabled button (matches this session's "no fake UI" bar: a disabled
  no-op button would be honest but less useful than a link that actually
  does what it visually implies).
- Premium: real button → `POST /api/clients/[id]/remind` → `window.open`
  the returned `wa.me` URL → `refresh()` the client fetch so the "dernier
  rappel envoyé le …" indicator updates immediately.
- Subscription status fetched via the same `/api/subscriptions` endpoint
  `/premium` already uses (`useApi`), not duplicated into the client
  detail response — keeps the two concerns (client data vs. billing
  status) separate, matches how `/premium` itself is built.

## Testing

- `reminder.test.ts` — 7 unit tests (message content, FCFA formatting,
  shop-name fallback, wa.me URL encoding).
- `[id]/remind/route.test.ts` — 10 tests (auth, CSRF, Premium gate, 404
  existence-leak, no-phone, nothing-owed, happy path incl. message
  content assertions, shop-name fallback).
- `[id]/route.test.ts` — 1 new test for the added `lastReminderSentAt`
  field.

## Implementation checklist
- [x] `Client.lastReminderSentAt` + migration
- [x] `reminder.ts` (TDD: red confirmed, then green)
- [x] `POST /api/clients/[id]/remind` + tests
- [x] `GET /api/clients/[id]` returns `lastReminderSentAt` + test
- [x] Fiche client reminder card wired for real (Premium-gated, hidden
      when no phone/no balance, indicator shown)
- [x] typecheck/lint/format/build — all clean
- [x] Functional check against a live dev server + real Neon DB: signup →
      client w/ phone + debt → 403 PREMIUM_REQUIRED (free tier) →
      Subscription activated directly in DB (BICTORYS unconfigured in
      dev, same technique as Phase 7 verification) → 409 CLIENT_NO_PHONE
      on a phone-less client → 200 with correct wa.me URL (name/amount/
      shop-name interpolated correctly) + `lastReminderSentAt` stamped →
      confirmed via a follow-up GET → 409 NOTHING_OWED after an
      offsetting payment. Test data cleaned up, dev server stopped.
