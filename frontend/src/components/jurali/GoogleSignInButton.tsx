'use client';

// "Continuer avec Google" — plain <a> (not a client-side router push):
// this must be a full page navigation so the browser actually follows the
// 302 chain to accounts.google.com. Works for both /login and /signup —
// the callback (OAUTH-02/03) find-or-creates by email either way, so one
// button covers both flows.
//
// Guards against a double-click firing two /start requests: each hit mints
// a fresh one-time state+PKCE cookie, so if a second request's response
// lands after the browser has already followed the first one's redirect,
// it overwrites the cookie with a state that no longer matches the URL
// Google sends back — OAUTH_STATE_MISMATCH at the callback. Disabling the
// link after the first click prevents the second request outright.
import { useState } from 'react';
import { GoogleIcon } from './GoogleIcon';

export function GoogleSignInButton({ next = '/dashboard' }: { next?: string }) {
  const [clicked, setClicked] = useState(false);

  return (
    <a
      href={`/api/auth/oauth/google/start?next=${encodeURIComponent(next)}`}
      aria-disabled={clicked}
      onClick={(e) => {
        if (clicked) {
          e.preventDefault();
          return;
        }
        setClicked(true);
      }}
      className={`w-full flex items-center justify-center gap-3 bg-background border border-border text-foreground font-headings font-bold text-base py-3.5 rounded-xl ${
        clicked ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      <GoogleIcon size={18} />
      Continuer avec Google
    </a>
  );
}
