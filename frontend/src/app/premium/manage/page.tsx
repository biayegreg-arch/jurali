'use client';

// Gestion Premium — Banani's GestionPremium.jsx (drops the fabricated
// annual-plan upsell + invoice history + Total payé/Économie annuelle
// stats — no payment ledger exists to back them; see
// .planning/banani/premium-manage.md for the full decision list).
// Reached from /premium (auto-redirect once active) and Settings.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi, invalidateAllCache } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { useAsyncAction } from '@/lib/useAsyncAction';
import { Icon } from '@/components/jurali/Icon';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { ConfirmDialog } from '@/components/jurali/ConfirmDialog';
import { PageTransition } from '@/components/jurali/PageTransition';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';
import { PREMIUM_FEATURES } from '@/lib/jurali-premium';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  totalClientCount: number;
}

interface SubscriptionData {
  isActive: boolean;
  renewsAt: string | null;
  planAmountFcfa: number;
  paymentMethod: string | null;
  paymentPhone: string | null;
  createdAt: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  WAVE: 'Wave Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  FREE_MONEY: 'Free Money',
};

export default function PremiumManagePage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: sub, loading: subLoading } = useApi<SubscriptionData>('/api/subscriptions', {
    skip: !user,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const { pending, run } = useAsyncAction();

  const isActive = sub?.isActive ?? false;
  useEffect(() => {
    if (!subLoading && !isActive) router.replace('/premium');
  }, [subLoading, isActive, router]);

  if (!user || !isActive) return null;

  async function cancel() {
    await run(
      async () => {
        await api('/api/subscriptions', { method: 'DELETE' });
        invalidateAllCache();
        setConfirmOpen(false);
        router.push('/premium');
      },
      (err) => {
        const message = err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.';
        toast(message, 'error');
        return message;
      },
    );
  }

  const planAmount = sub?.planAmountFcfa ?? 2500;
  const methodLabel = sub?.paymentMethod
    ? (METHOD_LABELS[sub.paymentMethod] ?? sub.paymentMethod)
    : null;

  return (
    <PageTransition>
      <div className="min-h-dvh bg-background font-body flex lg:flex-row">
        <div className="hidden lg:block">
          <DesktopSidebar
            displayName={user.shopName || user.email}
            fullName={user.name}
            totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
            debtorCount={dashboard?.debtorCount ?? 0}
            overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
            overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
            loading={dashboardLoading}
            totalClientCount={dashboard?.totalClientCount ?? 0}
            isPremium
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-3 px-4 lg:px-8 pt-6 lg:pt-8 pb-5 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="w-10 h-10 rounded-lg bg-input border border-border flex items-center justify-center flex-shrink-0"
              >
                <Icon i="chevron-left" size={20} className="text-foreground" />
              </button>
              <div>
                <div className="font-headings font-bold text-xl lg:text-2xl text-foreground">
                  Gestion Premium
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Ton abonnement et ta facturation
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="hidden lg:flex items-center gap-2 bg-input border border-border text-danger font-headings font-bold text-sm px-4 py-2 rounded-lg"
            >
              <Icon i="x-circle" size={16} />
              Résilier l’abonnement
            </button>
          </div>

          <div className="px-4 lg:px-8 py-6 lg:py-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
            <div className="flex flex-col gap-5 lg:w-[340px] lg:flex-shrink-0">
              <div className="bg-primary rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Icon i="crown" size={16} className="text-accent" />
                    <span className="font-headings font-bold text-sm text-secondary uppercase tracking-widest">
                      Plan actuel
                    </span>
                  </div>
                  <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-2.5 py-1 rounded-lg">
                    Actif
                  </span>
                </div>
                <div className="font-headings font-bold text-3xl lg:text-4xl text-primary-foreground mb-1">
                  Premium
                </div>
                <div className="font-headings font-bold text-2xl text-primary-foreground mt-2">
                  {formatPrice(planAmount)}{' '}
                  <span className="text-base font-body font-normal text-secondary">
                    FCFA / mois
                  </span>
                </div>
                <div
                  className="mt-4 pt-4 flex flex-col gap-2"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Prochain paiement</span>
                    <span className="text-xs font-headings font-bold text-primary-foreground">
                      {sub?.renewsAt ? formatDateFr(sub.renewsAt) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Actif depuis</span>
                    <span className="text-xs font-headings font-bold text-primary-foreground">
                      {sub?.createdAt ? formatDateFr(sub.createdAt) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Renouvellement</span>
                    <span className="text-xs font-headings font-bold text-primary-foreground">
                      Mensuel
                    </span>
                  </div>
                </div>
              </div>

              {methodLabel && (
                <div className="bg-background border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon i="credit-card" size={16} className="text-primary" />
                    <span className="font-headings font-bold text-sm text-foreground">
                      Moyen de paiement
                    </span>
                  </div>
                  <div className="flex items-center gap-3 bg-input rounded-lg px-4 py-3">
                    <Icon i="smartphone" size={20} className="text-foreground flex-shrink-0" />
                    <div>
                      <div className="font-headings font-bold text-sm text-foreground">
                        {methodLabel}
                      </div>
                      {sub?.paymentPhone && (
                        <div className="text-xs text-muted-foreground">{sub.paymentPhone}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="lg:hidden w-full flex items-center justify-center gap-2 bg-input border border-border text-danger font-headings font-bold text-sm py-3.5 rounded-xl"
              >
                <Icon i="x-circle" size={16} />
                Résilier l’abonnement
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-5 min-w-0">
              <div className="bg-background border border-border rounded-xl p-5">
                <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Clients gérés
                </div>
                <div className="font-headings font-bold text-2xl text-foreground">
                  {dashboard?.totalClientCount ?? 0}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Illimité avec Premium</div>
              </div>

              <div className="bg-background border border-border rounded-xl p-5">
                <div className="font-headings font-bold text-base text-foreground mb-4">
                  Fonctionnalités incluses
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PREMIUM_FEATURES.map((f) => (
                    <div key={f.label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <Icon i={f.icon} size={14} className="text-secondary-foreground" />
                      </div>
                      <span className="text-sm text-foreground">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Résilier l’abonnement ?"
        message="Tu perdras l’accès Premium immédiatement, même s’il te reste des jours payés. Cette action est irréversible."
        confirmLabel={pending ? 'Résiliation…' : 'Résilier maintenant'}
        variant="danger"
        icon="x-circle"
        onConfirm={cancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageTransition>
  );
}
