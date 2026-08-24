// "Continuer avec Google" — plain <a> (not a client-side router push):
// this must be a full page navigation so the browser actually follows the
// 302 chain to accounts.google.com. Works for both /login and /signup —
// the callback (OAUTH-02/03) find-or-creates by email either way, so one
// button covers both flows.
import { GoogleIcon } from './GoogleIcon';

export function GoogleSignInButton({ next = '/dashboard' }: { next?: string }) {
  return (
    <a
      href={`/api/auth/oauth/google/start?next=${encodeURIComponent(next)}`}
      className="w-full flex items-center justify-center gap-3 bg-background border border-border text-foreground font-headings font-bold text-base py-3.5 rounded-xl"
    >
      <GoogleIcon size={18} />
      Continuer avec Google
    </a>
  );
}
