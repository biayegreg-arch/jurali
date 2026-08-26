// Phone-only accounts (no email collected) get a synthetic, non-deliverable
// placeholder email instead of a schema change — see the comment on
// `User.email` in schema.prisma. Shared between /api/auth/phone-signup
// (creates it) and /api/auth/me PATCH (must keep it in sync on phone change).
const SYNTHETIC_DOMAIN = '@phone.jurali.local';

export function syntheticEmail(phone: string): string {
  return `${phone.replace(/\+/g, '')}${SYNTHETIC_DOMAIN}`;
}

export function isSyntheticEmail(email: string): boolean {
  return email.endsWith(SYNTHETIC_DOMAIN);
}
