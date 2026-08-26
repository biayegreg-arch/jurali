// Normalizes a free-text phone input to E.164 before it hits `zPhone`
// (server-side validation requires a leading `+`, see zod-helpers.ts).
// Client-facing phone fields (create/edit client, profile) are plain free
// text with no split "+221 | local number" UI like login/signup's
// account-phone fields — a bare local number (the common case for a
// Senegalese shopkeeper typing a client's number, e.g. "77 920 66 93")
// would otherwise fail zPhone's regex with a raw VALIDATION_FAILED. An
// input that already starts with "+" is assumed to already carry a
// country code (an international client) and is left as typed, digits
// only.
export function normalizePhoneInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+221${digits}` : '';
}
