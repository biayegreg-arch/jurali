'use client';

// Jurali dashboard — PRD 3.2 (Accueil / Tableau de bord). Reproduces
// Banani's JuraliDashboard.jsx; see .planning/banani/dashboard.md for the
// full translation notes and confirmed decisions.
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { TopBar } from '@/components/jurali/TopBar';
import { DebtorRow } from '@/components/jurali/DebtorRow';
import { toDebtorRowProps } from '@/lib/jurali-format';
import type { ClientSummary } from '@/lib/server/jurali/clients';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  recoveredThisMonthFcfa: number;
}

export default function DashboardPage() {
  const user = useUser();
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: clients, loading: clientsLoading } = useApi<{ items: ClientSummary[] }>(
    '/api/clients?sort=activity&order=desc&limit=5',
    { skip: !user },
  );

  if (!user) return null;

  const recentClients = clients?.items ?? [];

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col">
      <TopBar
        displayName={user.shopName || user.email}
        totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
        debtorCount={dashboard?.debtorCount ?? 0}
        overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
        overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
        loading={dashboardLoading}
      />

      <div className="max-w-2xl w-full mx-auto flex flex-col">
        {/* Search bar — navigates to the full client list (search happens there) */}
        <Link href="/clients" className="px-4 pt-4 pb-2 block">
          <div className="flex items-center gap-2 bg-input border border-border rounded-xl px-3 py-2.5">
            <Icon i="search" size={16} className="text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Chercher un client...</span>
          </div>
        </Link>

        {/* Filter chips — navigate to the full list; month filters deferred (Phase 9, see debtor-list.md) */}
        <div className="flex gap-2 px-4 py-2">
          <Link
            href="/clients"
            className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg"
          >
            Tous
          </Link>
          <Link
            href="/clients?filter=overdue"
            className="bg-surface border border-border text-foreground text-xs px-3 py-1.5 rounded-lg"
          >
            En retard
          </Link>
        </div>

        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="font-headings font-bold text-sm text-foreground uppercase tracking-wide">
            Débiteurs
          </div>
          <Link href="/clients?sort=amount" className="text-xs text-muted-foreground">
            Trier par montant
          </Link>
        </div>

        <div className="mx-4 bg-background border border-border rounded-xl overflow-hidden">
          {clientsLoading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Chargement…</div>
          ) : recentClients.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Aucun client pour l&rsquo;instant — ajoute ton premier client en enregistrant une
              dette.
            </div>
          ) : (
            recentClients.map((c, i) => <DebtorRow key={c.id} {...toDebtorRowProps(c, i)} />)
          )}
        </div>

        {/* PRD 3.2/§4: 2 always-visible large action buttons (P0). Banani's
            mockup only shows "Nouvelle dette" + an inert Statistiques icon
            (no screen designed for that, Phase 9) — "Paiement reçu" replaces
            it here since the PRD explicitly requires both. */}
        <div className="px-4 pt-4 pb-8 flex gap-3">
          <Link
            href="/debts/new"
            className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl"
          >
            <Icon i="plus" size={20} />
            Nouvelle dette
          </Link>
          <Link
            href="/payments/new"
            className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-base py-4 rounded-xl"
          >
            <Icon i="check" size={20} />
            Paiement reçu
          </Link>
        </div>
      </div>
    </div>
  );
}
