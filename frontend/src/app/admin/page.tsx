'use client';

// Vue d'ensemble — Banani's AdminDashboard.jsx, pixel-matched at 1280px.
// Every number is a real aggregate from GET /api/admin/overview — no
// fabricated month-over-month trend arrows (Banani's "+12% / +8% / -2%")
// and no fake 2023-vs-2024 revenue comparison: there's no historical
// snapshot to back either, so both are dropped rather than invented (see
// .planning/banani/admin-console.md).
import Link from 'next/link';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { Skeleton } from '@/components/jurali/Skeleton';
import { PageTransition } from '@/components/jurali/PageTransition';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminKpiCard } from '@/components/admin/AdminKpiCard';
import { AdminRevenueChart } from '@/components/admin/AdminRevenueChart';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';

interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  shopName: string | null;
  createdAt: string;
  isPremium: boolean;
  clientCount: number;
  outstandingBalanceFcfa: number;
}

interface RecentPayment {
  id: string;
  createdAt: string;
  status: 'PAID' | 'FAILED';
  amountFcfa: number;
  ownerEmail: string;
  ownerShopName: string | null;
}

interface Overview {
  kpis: {
    totalUsers: number;
    premiumCount: number;
    freeCount: number;
    mrrFcfa: number;
    conversionRate: number;
    premiumMonthlyPriceFcfa: number;
  };
  monthlyRevenue: { month: string; totalFcfa: number }[];
  recentUsers: RecentUser[];
  recentPayments: RecentPayment[];
}

const TODAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(new Date());

export default function AdminOverviewPage() {
  const { data, loading } = useApi<Overview>('/api/admin/overview');

  const kpis = data?.kpis;
  const premiumPct = kpis && kpis.totalUsers > 0 ? Math.round(kpis.conversionRate * 100) : 0;

  return (
    <PageTransition>
      <AdminPageHeader
        title="Vue d'ensemble"
        subtitle={`${TODAY.charAt(0).toUpperCase()}${TODAY.slice(1)} · Dakar, Sénégal`}
      />

      <div className="px-4 lg:px-8 py-6 lg:py-7 flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminKpiCard
            label="Utilisateurs"
            value={kpis?.totalUsers ?? 0}
            icon="users"
            iconBg="bg-secondary"
            iconColor="text-secondary-foreground"
            format={(n) => n.toLocaleString('fr-FR')}
            loading={loading}
          />
          <AdminKpiCard
            label="Abonnés Premium"
            value={kpis?.premiumCount ?? 0}
            icon="crown"
            iconBg="bg-primary"
            iconColor="text-primary-foreground"
            format={(n) => n.toLocaleString('fr-FR')}
            loading={loading}
          />
          <AdminKpiCard
            label="Revenu mensuel (MRR)"
            value={kpis?.mrrFcfa ?? 0}
            icon="trending-up"
            iconBg="bg-accent"
            iconColor="text-accent-foreground"
            loading={loading}
          />
          <AdminKpiCard
            label="Taux de conversion"
            value={premiumPct}
            suffix="%"
            icon="percent"
            iconBg="bg-input"
            iconColor="text-foreground"
            format={(n) => n.toLocaleString('fr-FR')}
            loading={loading}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 bg-background border border-border rounded-xl p-5 min-w-0">
            <div className="font-headings font-bold text-base text-foreground mb-5">
              Revenus mensuels (réel)
            </div>
            <AdminRevenueChart points={data?.monthlyRevenue ?? []} loading={loading} />
          </div>

          <div className="bg-background border border-border rounded-xl p-5 flex flex-col gap-4 lg:w-[220px] flex-shrink-0">
            <div className="font-headings font-bold text-base text-foreground">
              Répartition plans
            </div>
            {loading ? (
              <>
                <div className="flex items-center justify-center py-2">
                  <Skeleton className="w-24 h-24 rounded-full" />
                </div>
                <div className="flex flex-col gap-2.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center py-2">
                  <div
                    className="relative w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `conic-gradient(var(--color-primary) 0% ${premiumPct}%, var(--color-muted) ${premiumPct}% 100%)`,
                    }}
                  >
                    <div className="w-14 h-14 rounded-full bg-background flex flex-col items-center justify-center">
                      <div className="font-headings font-bold text-base text-foreground">
                        {premiumPct}%
                      </div>
                      <div className="text-xs text-muted-foreground">Premium</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-sm text-foreground">Premium</span>
                    </div>
                    <span className="font-headings font-bold text-sm text-foreground">
                      {kpis?.premiumCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-muted flex-shrink-0" />
                      <span className="text-sm text-foreground">Gratuit</span>
                    </div>
                    <span className="font-headings font-bold text-sm text-foreground">
                      {kpis?.freeCount ?? 0}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 bg-background border border-border rounded-xl overflow-hidden min-w-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="font-headings font-bold text-base text-foreground">
                Nouveaux utilisateurs
              </div>
              <Link href="/admin/users" className="text-xs font-headings font-bold text-primary">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-border">
              {loading && (data?.recentUsers.length ?? 0) === 0
                ? Array.from({ length: 5 }, (_, i) => <RecentUserSkeleton key={i} />)
                : (data?.recentUsers ?? []).map((u) => (
                    <div key={u.id} className="flex items-center px-5 py-3 gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <span className="font-headings font-bold text-xs text-secondary-foreground">
                          {(u.name || u.shopName || u.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-headings font-bold text-sm text-foreground truncate">
                          {u.name || u.email}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.shopName || u.email}
                        </div>
                      </div>
                      <div
                        className="text-right flex-shrink-0 hidden sm:block"
                        style={{ width: 100 }}
                      >
                        <div className="font-headings font-bold text-sm text-foreground">
                          {u.clientCount} client{u.clientCount > 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(u.outstandingBalanceFcfa)} FCFA
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {u.isPremium ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground font-bold text-xs">
                            <Icon i="crown" size={10} />
                            Premium
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-input border border-border text-muted-foreground font-bold text-xs">
                            Gratuit
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              {!loading && (data?.recentUsers.length ?? 0) === 0 && (
                <div className="px-5 py-6 text-sm text-muted-foreground">Aucun utilisateur.</div>
              )}
            </div>
          </div>

          <div className="bg-background border border-border rounded-xl overflow-hidden lg:w-[340px] flex-shrink-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="font-headings font-bold text-base text-foreground">
                Paiements récents
              </div>
              <Link href="/admin/revenue" className="text-xs font-headings font-bold text-primary">
                Voir tout
              </Link>
            </div>
            <div className="divide-y divide-border">
              {loading && (data?.recentPayments.length ?? 0) === 0
                ? Array.from({ length: 4 }, (_, i) => <RecentPaymentSkeleton key={i} />)
                : (data?.recentPayments ?? []).map((p) => (
                    <div key={p.id} className="flex items-center px-5 py-3.5 gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          p.status === 'PAID' ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <Icon
                          i={p.status === 'PAID' ? 'check' : 'x'}
                          size={14}
                          className={p.status === 'PAID' ? 'text-green-700' : 'text-danger'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-headings font-bold text-sm text-foreground truncate">
                          {p.ownerShopName || p.ownerEmail}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateFr(p.createdAt)}
                        </div>
                      </div>
                      <div
                        className={`font-headings font-bold text-sm flex-shrink-0 ${
                          p.status === 'PAID' ? 'text-foreground' : 'text-danger line-through'
                        }`}
                      >
                        {formatPrice(p.amountFcfa)} FCFA
                      </div>
                    </div>
                  ))}
              {!loading && (data?.recentPayments.length ?? 0) === 0 && (
                <div className="px-5 py-6 text-sm text-muted-foreground">
                  Aucun paiement récent.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function RecentUserSkeleton() {
  return (
    <div className="flex items-center px-5 py-3 gap-3">
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-5 w-16 rounded-md flex-shrink-0" />
    </div>
  );
}

function RecentPaymentSkeleton() {
  return (
    <div className="flex items-center px-5 py-3.5 gap-3">
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-16 flex-shrink-0" />
    </div>
  );
}
