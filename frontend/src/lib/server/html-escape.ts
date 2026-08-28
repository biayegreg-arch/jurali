// Shared by every email template (auth/email-templates.ts,
// subscriptions/email-templates.ts, …) — escape at the source so a
// careless interpolation into an HTML template string can't inject markup.
export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
