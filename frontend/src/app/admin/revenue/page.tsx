'use client';

// Revenus — no Banani mockup (only the dashboard was designed). Real MRR +
// monthly history + a fuller payment list than the dashboard widget, all
// from GET /api/admin/revenue (see lib/server/jurali/admin-revenue.ts for
// the WebhookLog-correlation approach and its documented limitation).
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { Skeleton } from '@/components/jurali/Skeleton';
import { PageTransition } from '@/components/jurali/PageTransition';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminKpiCard } from '@/components/admin/AdminKpiCard';
import { AdminRevenueChart } from '@/components/admin/AdminRevenueChart';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';

interface Payment {
  id: string;
  createdAt: string;
  status: 'PAID' | 'FAILED';
  amountFcfa: number;
  ownerEmail: string;
  ownerShopName: string | null;
}

interface Revenue {
  mrrFcfa: number;
  activeSubscriptionCount: number;
  monthlyRevenue: { month: string; totalFcfa: number }[];
  payments: Payment[];
  paidCount: number;
  failedCount: number;
}

export default function AdminRevenuePage() {
  const { data, loading } = useApi<Revenue>('/api/admin/revenue');

  return (
    <PageTransition>
      <AdminPageHeader title="Revenus" subtitle="Revenus Premium réels" />

      <div className="px-4 lg:px-8 py-6 lg:py-7 flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminKpiCard
            label="Revenu mensuel (MRR)"
            value={data?.mrrFcfa ?? 0}
            icon="trending-up"
            iconBg="bg-accent"
            iconColor="text-accent-foreground"
            loading={loading}
          />
          <AdminKpiCard
            label="Abonnés actifs"
            value={data?.activeSubscriptionCount ?? 0}
            icon="zap"
            iconBg="bg-primary"
            iconColor="text-primary-foreground"
            format={(n) => n.toLocaleString('fr-FR')}
            loading={loading}
          />
          <div className="bg-background border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground">
                Paiements (échantillon récent)
              </div>
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Icon i="check-circle" size={14} className="text-secondary-foreground" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="font-headings font-bold text-2xl text-foreground">
                {data?.paidCount ?? 0} réussis
              </div>
            )}
            {!loading && (
              <div className="text-xs text-muted-foreground mt-1">
                {data?.failedCount ?? 0} échoués
              </div>
            )}
          </div>
        </div>

        <div className="bg-background border border-border rounded-xl p-5">
          <div className="font-headings font-bold text-base text-foreground mb-5">
            Revenus mensuels (réel — se remplit avec l&rsquo;activité)
          </div>
          <AdminRevenueChart points={data?.monthlyRevenue ?? []} loading={loading} />
        </div>

        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="font-headings font-bold text-base text-foreground">
              Paiements récents
            </div>
          </div>
          <div className="divide-y divide-border">
            {loading && (data?.payments.length ?? 0) === 0
              ? Array.from({ length: 5 }, (_, i) => <PaymentRowSkeleton key={i} />)
              : (data?.payments ?? []).map((p) => (
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
            {!loading && (data?.payments.length ?? 0) === 0 && (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                Aucun paiement pour l&rsquo;instant.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function PaymentRowSkeleton() {
  return (
    <div className="flex items-center px-5 py-3.5 gap-3">
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-16 flex-shrink-0" />
    </div>
  );
}
