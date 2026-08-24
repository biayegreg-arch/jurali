'use client';

// Landing page for POST /api/subscriptions' successUrl — Bictorys redirects
// here after a successful checkout. The actual activation happens
// server-side via the webhook (POST /api/webhooks/bictorys), which can
// lag the redirect by a few seconds, so this just confirms and points the
// user back to Premium/dashboard rather than claiming instant activation.
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { Icon } from '@/components/jurali/Icon';

export default function PremiumSuccessPage() {
  const user = useUser();
  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background font-body flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Icon i="zap" size={28} className="text-primary" />
        </div>
        <div className="font-headings font-bold text-2xl text-foreground">Paiement reçu</div>
        <p className="text-sm text-muted-foreground">
          Ton abonnement Premium est en cours d&rsquo;activation — ça ne prend que quelques
          secondes.
        </p>
        <Link
          href="/premium"
          className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl mt-2"
        >
          Voir mon abonnement
        </Link>
        <Link href="/" className="text-sm text-muted-foreground">
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
