'use client';

// Statistiques — Phase 9 (Banani's `StatisticsDesktop.jsx`; no mobile mock
// was provided, so the mobile layout below is designed fresh — see
// .planning/banani/statistics.md). Premium-gated: `/premium` already
// advertises "Statistiques avancées" as Premium-exclusive (confirmed
// 2026-08-26), so a free-tier user sees an upsell instead of the real page,
// and `/api/stats` is never even called for them.
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { TopBar, NotificationBell } from '@/components/jurali/TopBar';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { StatCard } from '@/components/jurali/StatCard';
import { PageTransition } from '@/components/jurali/PageTransition';
import { AnimatedNumber } from '@/components/jurali/AnimatedNumber';
import { formatPrice } from '@/lib/utils';

interface SubscriptionData {
  isActive: boolean;
}

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  totalClientCount: number;
}

interface MonthlyTrendBucket {
  month: string;
  label: string;
  newDebtsFcfa: number;
  recoveredFcfa: number;
}

interface StatsData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  averageDebtFcfa: number;
  totalPaidFcfa: number;
  recoveryRatePercent: number;
  monthlyTrend: MonthlyTrendBucket[];
}

export default function StatsPage() {
  const user = useUser();
  const { data: subscription, loading: subLoading } = useApi<SubscriptionData>(
    '/api/subscriptions',
    { skip: !user },
  );
  // Sidebar KPI tiles need the same numbers as /clients and /dashboard —
  // fetched regardless of premium status (the sidebar itself isn't gated).
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });
  const notificationCount = notifData?.count ?? 0;

  if (!user) return null;

  const isPremium = subscription?.isActive ?? false;
  const displayName = user.shopName || user.email;

  return (
    <PageTransition>
      <div className="min-h-dvh bg-background font-body flex flex-col lg:flex-row">
        <DesktopSidebar
          displayName={displayName}
          fullName={user.name}
          totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
          debtorCount={dashboard?.debtorCount ?? 0}
          overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
          overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
          loading={dashboardLoading}
          totalClientCount={dashboard?.totalClientCount ?? 0}
          isPremium={isPremium}
        />

        {/* Mobile/tablet (< lg) */}
        <div className="flex-1 flex flex-col lg:hidden">
          <TopBar
            displayName={displayName}
            totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
            debtorCount={dashboard?.debtorCount ?? 0}
            overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
            overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
            loading={dashboardLoading}
            notificationCount={notificationCount}
          />
          <div className="max-w-2xl w-full mx-auto flex flex-col px-4 pt-5 pb-8">
            <div className="font-headings font-bold text-xl text-foreground mb-4">Statistiques</div>
            {subLoading ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : isPremium ? (
              <StatsBody />
            ) : (
              <StatsUpsell />
            )}
          </div>
        </div>

        {/* Desktop (lg+) */}
        <div className="hidden lg:flex flex-1 flex-col">
          <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
            <div>
              <div className="font-headings font-bold text-2xl text-foreground">Statistiques</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
                  new Date(),
                )}
              </div>
            </div>
            <NotificationBell count={notificationCount} />
          </div>
          <div className="px-8 pt-8 pb-8 flex-1">
            {subLoading ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : isPremium ? (
              <StatsBody />
            ) : (
              <StatsUpsell />
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function StatsUpsell() {
  return (
    <Link
      href="/premium"
      className="bg-secondary border border-border rounded-xl px-5 py-6 flex flex-col items-center gap-3 text-center max-w-md mx-auto"
    >
      <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center">
        <Icon i="bar-chart-2" size={22} className="text-primary" />
      </div>
      <div className="font-headings font-bold text-base text-foreground">
        Statistiques avancées — réservé à Premium
      </div>
      <div className="text-sm text-muted-foreground">
        Taux de recouvrement, dette moyenne et tendances sur 6 mois pour piloter ta boutique.
      </div>
      <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-3 py-1.5 rounded-lg">
        Passer à Premium
      </span>
    </Link>
  );
}

function StatsBody() {
  const { data: stats, loading } = useApi<StatsData>('/api/stats');

  if (loading || !stats) {
    return <div className="text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <StatCard
          label="Total dû"
          value={<AnimatedNumber value={stats.totalDueFcfa} />}
          unit="FCFA"
          sub={`${stats.debtorCount} client${stats.debtorCount === 1 ? '' : 's'}`}
          icon="wallet"
        />
        <StatCard
          label="En retard"
          value={<AnimatedNumber value={stats.overdueDueFcfa} />}
          unit="FCFA"
          sub={`${stats.overdueDebtorCount} client${stats.overdueDebtorCount === 1 ? '' : 's'} urgent${stats.overdueDebtorCount === 1 ? '' : 's'}`}
          icon="alert-circle"
          tone="danger"
        />
        <StatCard
          label="Taux de recouvrement"
          value={
            <AnimatedNumber value={stats.recoveryRatePercent} format={(n) => `${Math.round(n)}%`} />
          }
          unit="collecté"
          sub={`Moyenne ${formatPrice(stats.averageDebtFcfa)}`}
          icon="trending-up"
          tone="primary"
        />
      </div>

      <MonthlyTrendChart trend={stats.monthlyTrend} />
    </div>
  );
}

function MonthlyTrendChart({ trend }: { trend: MonthlyTrendBucket[] }) {
  const maxAmount = Math.max(1, ...trend.flatMap((m) => [m.newDebtsFcfa, m.recoveredFcfa]));

  return (
    <div className="bg-background border border-border rounded-xl p-5 lg:p-6">
      <div className="mb-5 lg:mb-6">
        <h3 className="font-headings font-bold text-base lg:text-lg text-foreground">
          Tendances de 6 mois
        </h3>
        <p className="text-sm text-muted-foreground mt-1">Montant dû vs. collecté</p>
      </div>

      <div className="flex items-end justify-between gap-2 lg:gap-4 h-40 lg:h-64 pt-4 lg:pt-6 overflow-x-auto">
        {trend.map((m) => {
          const debtHeight = (m.newDebtsFcfa / maxAmount) * 100;
          const recoveredHeight = (m.recoveredFcfa / maxAmount) * 100;
          return (
            <div key={m.month} className="flex-1 flex flex-col gap-2 min-w-[32px]">
              <div className="flex gap-1 lg:gap-1.5 items-end h-24 lg:h-40">
                <motion.div
                  className="flex-1 bg-secondary rounded-t-md"
                  initial={{ height: 0 }}
                  animate={{ height: `${debtHeight}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.div
                  className="flex-1 bg-primary rounded-t-md"
                  initial={{ height: 0 }}
                  animate={{ height: `${recoveredHeight}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="text-xs font-headings font-bold text-center text-foreground">
                {m.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-6 mt-5 lg:mt-6 pt-5 lg:pt-6 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-secondary rounded" />
          <span className="text-sm text-muted-foreground">Montant dû</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary rounded" />
          <span className="text-sm text-muted-foreground">Collecté</span>
        </div>
      </div>
    </div>
  );
}
