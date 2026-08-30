'use client';

// Landing page for POST /api/subscriptions' successUrl — Bictorys redirects
// here after a successful checkout. The actual activation happens
// server-side via the webhook (POST /api/webhooks/bictorys), which can lag
// the redirect by a few seconds, so this polls GET /api/subscriptions
// (skeleton, not a spinner — matches the rest of the app) until isActive
// flips true, then shows the real charged amount/coupon/renewal date
// instead of a generic "you're all set" message.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { Skeleton } from '@/components/jurali/Skeleton';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';

interface SubscriptionData {
  isActive: boolean;
  status: string;
  renewsAt: string | null;
  paidAmountFcfa: number | null;
  coupon: { code: string; percentOff: number } | null;
  paymentMethod: string | null;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  FREE_MONEY: 'Free Money',
};

// Webhook lag is usually a few seconds; give it a generous window before
// admitting it's taking longer than expected rather than polling forever.
const POLL_INTERVAL_MS = 2000;
const GIVE_UP_AFTER_MS = 30_000;

export default function PremiumSuccessPage() {
  const user = useUser();
  const { data: sub, refresh } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  const [timedOut, setTimedOut] = useState(false);
  const startRef = useRef(Date.now());

  const isActive = sub?.isActive ?? false;

  useEffect(() => {
    if (isActive) return;
    const interval = window.setInterval(() => {
      if (Date.now() - startRef.current >= GIVE_UP_AFTER_MS) {
        setTimedOut(true);
        window.clearInterval(interval);
        return;
      }
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isActive, refresh]);

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background font-body flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center flex flex-col items-center gap-4">
        {isActive ? <ActiveState sub={sub} /> : timedOut ? <PendingState /> : <CheckingState />}
      </div>
    </div>
  );
}

function ActiveState({ sub }: { sub: SubscriptionData | null }) {
  const methodLabel = sub?.paymentMethod ? (PAYMENT_METHOD_LABEL[sub.paymentMethod] ?? null) : null;

  return (
    <>
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <Icon i="crown" size={28} className="text-primary" />
      </div>
      <div className="font-headings font-bold text-2xl text-foreground">
        Abonnement Premium actif
      </div>
      <p className="text-sm text-muted-foreground">
        Merci ! Ton paiement a été confirmé et Premium est activé sur ton compte.
      </p>

      <div className="w-full bg-input border border-border rounded-xl p-5 flex flex-col gap-3 text-left mt-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Plan</span>
          <span className="font-headings font-bold text-sm text-foreground">Premium Mensuel</span>
        </div>
        {sub?.paidAmountFcfa !== null && sub?.paidAmountFcfa !== undefined && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Montant payé</span>
            <span className="font-headings font-bold text-sm text-foreground">
              {formatPrice(sub.paidAmountFcfa)} FCFA
            </span>
          </div>
        )}
        {sub?.coupon && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Code promo</span>
            <span className="font-headings font-bold text-sm text-primary">
              {sub.coupon.code} (-{sub.coupon.percentOff}%)
            </span>
          </div>
        )}
        {methodLabel && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Moyen de paiement</span>
            <span className="font-headings font-bold text-sm text-foreground">{methodLabel}</span>
          </div>
        )}
        {sub?.renewsAt && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Prochain renouvellement</span>
            <span className="font-headings font-bold text-sm text-foreground">
              {formatDateFr(sub.renewsAt)}
            </span>
          </div>
        )}
      </div>

      <Link
        href="/dashboard"
        className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl mt-2"
      >
        Aller au dashboard
      </Link>
      <Link href="/premium/manage" className="text-sm text-muted-foreground">
        Gérer mon abonnement
      </Link>
    </>
  );
}

function CheckingState() {
  return (
    <>
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <Icon i="crown" size={28} className="text-primary" />
      </div>
      <div className="font-headings font-bold text-2xl text-foreground">Paiement reçu</div>
      <p className="text-sm text-muted-foreground">
        Ton abonnement Premium est en cours d&rsquo;activation — ça ne prend que quelques secondes.
      </p>
      <div className="w-full bg-input border border-border rounded-xl p-5 flex flex-col gap-3 mt-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
    </>
  );
}

function PendingState() {
  return (
    <>
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <Icon i="clock" size={28} className="text-primary" />
      </div>
      <div className="font-headings font-bold text-2xl text-foreground">Activation en cours</div>
      <p className="text-sm text-muted-foreground">
        Ça prend un peu plus de temps que prévu. Ton paiement a bien été reçu par notre système —
        vérifie ton abonnement dans quelques instants depuis Gestion Premium.
      </p>
      <Link
        href="/premium/manage"
        className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl mt-2"
      >
        Voir mon abonnement
      </Link>
      <Link href="/dashboard" className="text-sm text-muted-foreground">
        Retour au dashboard
      </Link>
    </>
  );
}
