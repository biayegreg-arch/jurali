'use client';

// Liste des débiteurs — PRD 3.5. Reproduces Banani's DashboardAll.jsx; see
// .planning/banani/debtor-list.md for translation notes and decisions.
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { useDebtorListState } from '@/lib/useDebtorListState';
import { Icon } from '@/components/jurali/Icon';
import { TopBar } from '@/components/jurali/TopBar';
import { DebtorRow } from '@/components/jurali/DebtorRow';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { DesktopDebtorWorkspace } from '@/components/jurali/DesktopDebtorWorkspace';
import { toDebtorRowProps } from '@/lib/jurali-format';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
}

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsPageContent />
    </Suspense>
  );
}

function ClientsPageContent() {
  const user = useUser();
  const params = useSearchParams();

  const {
    query,
    setQuery,
    debouncedQuery,
    sort,
    setSort,
    overdueOnly,
    setOverdueOnly,
    monthActive,
    setMonthActive,
    month,
    setMonth,
    items,
    clientsLoading,
  } = useDebtorListState({ skip: !user, initialOverdueOnly: params.get('filter') === 'overdue' });

  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  // Hoisted once: both the mobile TopBar's bell and the desktop content
  // bar's bell render on every load (Tailwind's hidden/lg:hidden is
  // CSS-only, not conditional mounting) — without a single shared fetch
  // here, both would independently call useApi for the same path and fire
  // two simultaneous GETs (useApi's cache doesn't dedupe concurrent misses).
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });
  const notificationCount = notifData?.count ?? 0;

  if (!user) return null;

  const displayName = user.shopName || user.email;

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col lg:flex-row">
      <DesktopSidebar
        displayName={displayName}
        fullName={user.name}
        totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
        debtorCount={dashboard?.debtorCount ?? 0}
        overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
        overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
        loading={dashboardLoading}
      />

      {/* Mobile/tablet (< lg) — unchanged card-list layout */}
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

        <div className="max-w-2xl w-full mx-auto flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 bg-input border border-border rounded-xl px-3 py-2.5">
              <Icon i="search" size={16} className="text-muted-foreground flex-shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Chercher un client..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 px-4 py-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setOverdueOnly(false)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 ${
                overdueOnly
                  ? 'bg-surface border border-border text-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setOverdueOnly(true)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 ${
                overdueOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface border border-border text-foreground'
              }`}
            >
              En retard
            </button>
          </div>

          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="font-headings font-bold text-sm text-foreground uppercase tracking-wide">
              Débiteurs
            </div>
            <button
              type="button"
              onClick={() => setSort(sort === 'amount' ? 'activity' : 'amount')}
              className="text-xs text-muted-foreground"
            >
              {clientsLoading
                ? ''
                : `${items.length} résultats · trier par ${sort === 'amount' ? 'ancienneté' : 'montant'}`}
            </button>
          </div>

          <div className="mx-4 bg-background border border-border rounded-xl overflow-hidden mb-4">
            {clientsLoading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Chargement…</div>
            ) : items.length === 0 && debouncedQuery ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Aucun client ne correspond à « {debouncedQuery} ».
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Aucun client pour l&rsquo;instant — ajoute ton premier client en enregistrant une
                dette.
              </div>
            ) : (
              items.map((c, i) => <DebtorRow key={c.id} {...toDebtorRowProps(c, i)} />)
            )}
          </div>

          <div className="px-4 pb-8 flex gap-3">
            <Link
              href="/debts/new"
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl"
            >
              <Icon i="plus" size={20} />
              Nouvelle dette
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop (lg+) — sidebar + full-width table, Banani's
          "Dashboard Desktop" screen (see debtor-list.md § Desktop
          sidebar + table for the route/scope decisions). Also mounted on
          /dashboard — see dashboard.md § Desktop sidebar + table. */}
      <DesktopDebtorWorkspace
        query={query}
        onQueryChange={setQuery}
        debouncedQuery={debouncedQuery}
        monthActive={monthActive}
        onSelectAllTime={() => setMonthActive(false)}
        onSelectMonth={() => setMonthActive(true)}
        month={month}
        onMonthChange={setMonth}
        overdueOnly={overdueOnly}
        onToggleOverdueOnly={() => setOverdueOnly((v) => !v)}
        items={items}
        clientsLoading={clientsLoading}
        notificationCount={notificationCount}
      />
    </div>
  );
}
