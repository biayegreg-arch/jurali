'use client';

// Liste des débiteurs — PRD 3.5. Reproduces Banani's DashboardAll.jsx; see
// .planning/banani/debtor-list.md for translation notes and decisions.
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { TopBar, NotificationBell } from '@/components/jurali/TopBar';
import { DebtorRow } from '@/components/jurali/DebtorRow';
import { DebtorTableRow } from '@/components/jurali/DebtorTableRow';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { MonthPicker } from '@/components/jurali/MonthPicker';
import { toDebtorRowProps } from '@/lib/jurali-format';
import {
  formatMonthParam,
  formatMonthLabelFr,
  parseMonthParam,
} from '@/lib/server/jurali/month-range';
import type { ClientSummary } from '@/lib/server/jurali/clients';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
}

const SEARCH_DEBOUNCE_MS = 300;

function currentMonthParam(): string {
  const now = new Date();
  return formatMonthParam(now.getFullYear(), now.getMonth());
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

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<'amount' | 'activity'>(
    params.get('sort') === 'amount' ? 'amount' : 'activity',
  );
  const [overdueOnly, setOverdueOnly] = useState(params.get('filter') === 'overdue');
  const [monthActive, setMonthActive] = useState(false);
  const [month, setMonth] = useState(currentMonthParam);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const listPath = `/api/clients?sort=${sort}&order=desc${
    debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ''
  }${monthActive ? `&month=${month}` : ''}`;
  const { data: clients, loading: clientsLoading } = useApi<{ items: ClientSummary[] }>(listPath, {
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

  const items = (clients?.items ?? []).filter((c) => !overdueOnly || c.isOverdue);
  const displayName = user.shopName || user.email;

  function resetToAll() {
    setMonthActive(false);
    setOverdueOnly(false);
  }

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col lg:flex-row">
      <DesktopSidebar
        displayName={displayName}
        totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
        debtorCount={dashboard?.debtorCount ?? 0}
        overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
        overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
        loading={dashboardLoading}
        overdueOnly={overdueOnly}
        onSelectAll={resetToAll}
        onSelectOverdue={() => setOverdueOnly(true)}
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
          sidebar + table for the route/scope decisions) */}
      <div className="hidden lg:flex flex-1 flex-col">
        <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
          <div className="font-headings font-bold text-2xl text-foreground">Tous les débiteurs</div>
          <NotificationBell count={notificationCount} />
        </div>

        <div className="px-8 pt-5 pb-4 flex items-center gap-4">
          <div className="flex items-center gap-2 bg-input border border-border rounded-xl px-4 py-2.5 flex-1 max-w-md">
            <Icon i="search" size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un client..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setMonthActive(false)}
              className={`text-sm font-bold px-4 py-2 rounded-lg ${
                !monthActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface border border-border text-foreground'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setMonthActive(true)}
              className={`text-sm px-4 py-2 rounded-lg ${
                monthActive
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-surface border border-border text-foreground'
              }`}
            >
              Ce mois
            </button>
            {monthActive && <MonthPicker month={month} onChange={setMonth} />}
            <button
              type="button"
              onClick={() => setOverdueOnly((v) => !v)}
              className={`text-sm px-4 py-2 rounded-lg ${
                overdueOnly
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'bg-surface border border-border text-foreground'
              }`}
            >
              En retard
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-8 pb-3">
          <div className="font-headings font-bold text-sm text-foreground uppercase tracking-wide">
            Débiteurs
          </div>
          <span className="text-sm text-muted-foreground">
            {clientsLoading
              ? ''
              : `${items.length} résultat${items.length === 1 ? '' : 's'}${
                  monthActive
                    ? ` — ${formatMonthLabelFr(parseMonthParam(month).year, parseMonthParam(month).month)}`
                    : ''
                }`}
          </span>
        </div>

        <div className="px-8 pb-8 flex-1">
          <div className="bg-background border border-border rounded-xl overflow-hidden h-full">
            <div className="flex items-center px-6 py-4 bg-muted border-b border-border font-headings font-bold text-sm text-foreground uppercase tracking-wide">
              <div className="w-12">Client</div>
              <div className="flex-1 pl-2">Produit</div>
              <div className="w-32 text-right">Montant</div>
              <div className="w-24 text-right">Ancienneté</div>
              <div className="w-24 text-right">Statut</div>
            </div>

            <div className="divide-y divide-border">
              {clientsLoading ? (
                <div className="px-6 py-6 text-sm text-muted-foreground">Chargement…</div>
              ) : items.length === 0 && debouncedQuery ? (
                <div className="px-6 py-6 text-sm text-muted-foreground">
                  Aucun client ne correspond à « {debouncedQuery} ».
                </div>
              ) : items.length === 0 ? (
                <div className="px-6 py-6 text-sm text-muted-foreground">
                  Aucun client pour l&rsquo;instant — ajoute ton premier client en enregistrant une
                  dette.
                </div>
              ) : (
                items.map((c, i) => <DebtorTableRow key={c.id} {...toDebtorRowProps(c, i)} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
