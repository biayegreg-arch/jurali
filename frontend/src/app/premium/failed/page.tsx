'use client';

// Landing page for POST /api/subscriptions' failureUrl.
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { Icon } from '@/components/jurali/Icon';

export default function PremiumFailedPage() {
  const user = useUser();
  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background font-body flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Icon i="x" size={28} className="text-danger" />
        </div>
        <div className="font-headings font-bold text-2xl text-foreground">Paiement échoué</div>
        <p className="text-sm text-muted-foreground">
          Le paiement n&rsquo;a pas abouti. Tu peux réessayer à tout moment.
        </p>
        <Link
          href="/premium"
          className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl mt-2"
        >
          Réessayer
        </Link>
        <Link href="/" className="text-sm text-muted-foreground">
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
