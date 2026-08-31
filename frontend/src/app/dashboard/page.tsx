'use client';

// Jurali dashboard — PRD 3.2 (Accueil / Tableau de bord). Reproduces
// Banani's JuraliDashboard.jsx; see .planning/banani/dashboard.md for the
// full translation notes and confirmed decisions.
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { useDebtorListState } from '@/lib/useDebtorListState';
import { useDeleteClient } from '@/lib/useDeleteClient';
import { Icon } from '@/components/jurali/Icon';
import { TopBar } from '@/components/jurali/TopBar';
import { DebtorRow } from '@/components/jurali/DebtorRow';
import { MonthPicker } from '@/components/jurali/MonthPicker';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { DesktopDebtorWorkspace } from '@/components/jurali/DesktopDebtorWorkspace';
import { PageTransition } from '@/components/jurali/PageTransition';
import { MotionLink } from '@/components/jurali/MotionLink';
import { DeleteClientConfirmDialog } from '@/components/jurali/DeleteClientConfirmDialog';
import { tapScale } from '@/lib/motion';
import { toDebtorRowProps } from '@/lib/jurali-format';
import { formatPrice } from '@/lib/utils';
import { formatMonthParam } from '@/lib/server/jurali/month-range';
import type { ClientSummary } from '@/lib/server/jurali/clients';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  totalClientCount: number;
  selectedMonthRecoveredFcfa: number;
  selectedMonthNewDebtsFcfa: number;
  selectedMonthTransactionCount: number;
}

interface SubscriptionData {
  isActive: boolean;
}

function currentMonthParam(): string {
  const now = new Date();
  return formatMonthParam(now.getFullYear(), now.getMonth());
}

export default function DashboardPage() {
  const user = useUser();
  const { toast } = useToast();
  const [historyMonth, setHistoryMonth] = useState(currentMonthParam);
  const {
    data: dashboard,
    loading: dashboardLoading,
    refresh: refreshDashboard,
  } = useApi<DashboardData>(`/api/dashboard?month=${historyMonth}`, { skip: !user });
  const {
    data: clients,
    loading: clientsLoading,
    refresh: refreshRecentClients,
  } = useApi<{ items: ClientSummary[] }>('/api/clients?sort=activity&order=desc&limit=5', {
    skip: !user,
  });
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  // Desktop (lg+) sidebar + full debtor table — same shared state/fetch as
  // `/clients`' desktop view (see .planning/banani/dashboard.md § Desktop
  // sidebar + table). Named `debtor*` here to avoid colliding with this
  // page's own `historyMonth` state above (unrelated: that one scopes the
  // "Historique mensuel" KPI cards, this one scopes which debtors the
  // desktop table shows).
  const {
    query: debtorQuery,
    setQuery: setDebtorQuery,
    debouncedQuery: debouncedDebtorQuery,
    overdueOnly: debtorOverdueOnly,
    setOverdueOnly: setDebtorOverdueOnly,
    monthActive: debtorMonthActive,
    setMonthActive: setDebtorMonthActive,
    month: debtorMonth,
    setMonth: setDebtorMonth,
    items: debtorItems,
    clientsLoading: debtorItemsLoading,
    refreshClients: refreshDebtorItems,
  } = useDebtorListState({ skip: !user });
  const deleteClient = useDeleteClient(
    async () => {
      await Promise.all([refreshDashboard(), refreshRecentClients(), refreshDebtorItems()]);
    },
    (message) => toast(message, 'error'),
  );
  // Hoisted once: the mobile TopBar's bell and the desktop workspace's bell
  // both mount simultaneously (Tailwind's hidden/lg:hidden is CSS-only,
  // not conditional rendering) — a single shared fetch avoids firing
  // `/api/notifications/count` twice on every load.
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });
  const notificationCount = notifData?.count ?? 0;

  if (!user) return null;

  const recentClients = clients?.items ?? [];
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
          isPremium={subscription?.isActive ?? false}
        />

        {/* Mobile/tablet (< lg) — unchanged KPI-hero + preview layout */}
        <div className="flex-1 flex flex-col lg:hidden">
          <TopBar
            displayName={displayName}
            totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
            debtorCount={dashboard?.debtorCount ?? 0}
            overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
            overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
            loading={dashboardLoading}
            notificationCount={notificationCount}
            totalClientCount={dashboard?.totalClientCount ?? 0}
            isPremium={subscription?.isActive ?? false}
          />

          <div className="max-w-2xl w-full mx-auto flex flex-col">
            {/* Search bar — navigates to the full client list (search happens there) */}
            <Link href="/clients" className="px-4 pt-4 pb-2 block">
              <div className="flex items-center gap-2 bg-input border border-border rounded-xl px-3 py-2.5">
                <Icon i="search" size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Chercher un client...</span>
              </div>
            </Link>

            {/* Filter chips — navigate to the full list (unrelated to the
              month-picker below, which scopes the recovered/new-debts
              figures, not this debtor-row list). */}
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
                recentClients.map((c, i) => (
                  <DebtorRow
                    key={c.id}
                    {...toDebtorRowProps(c, i)}
                    onDelete={deleteClient.requestDelete}
                  />
                ))
              )}
            </div>

            {/* Historique mensuel — Phase 9 (Banani's MonthPickerView, a UI
              affordance for browsing history, not a PRD requirement). */}
            <div className="px-4 pt-4 flex flex-col gap-2">
              <div className="font-headings font-bold text-sm text-foreground uppercase tracking-wide">
                Historique mensuel
              </div>
              <MonthPicker month={historyMonth} onChange={setHistoryMonth} />
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="bg-background border border-border rounded-xl px-4 py-4">
                  <div className="text-xs text-muted-foreground mb-1">Récupéré</div>
                  <div className="font-headings font-bold text-lg text-foreground">
                    {dashboardLoading
                      ? '…'
                      : formatPrice(dashboard?.selectedMonthRecoveredFcfa ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">FCFA</div>
                </div>
                <div className="bg-background border border-border rounded-xl px-4 py-4">
                  <div className="text-xs text-muted-foreground mb-1">Nouvelles dettes</div>
                  <div className="font-headings font-bold text-lg text-foreground">
                    {dashboardLoading
                      ? '…'
                      : formatPrice(dashboard?.selectedMonthNewDebtsFcfa ?? 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">FCFA</div>
                </div>
              </div>
            </div>

            {/* PRD 3.2/§4: 2 always-visible large action buttons (P0). Banani's
              mockup only shows "Nouvelle dette" + an inert Statistiques icon
              (no screen designed for that, Phase 9) — "Paiement reçu" replaces
              it here since the PRD explicitly requires both. */}
            <div className="px-4 pt-4 pb-8 flex gap-3">
              <MotionLink
                href="/debts/new"
                whileTap={tapScale}
                className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl"
              >
                <Icon i="plus" size={20} />
                Nouvelle dette
              </MotionLink>
              <MotionLink
                href="/payments/new"
                whileTap={tapScale}
                className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-base py-4 rounded-xl"
              >
                <Icon i="check" size={20} />
                Paiement reçu
              </MotionLink>
            </div>
          </div>
        </div>

        {/* Desktop (lg+) — same sidebar + full-width debtor table as
          /clients (see dashboard.md § Desktop sidebar + table: the user
          confirmed this exact Banani screen belongs on /dashboard, not
          only /clients). */}
        <DesktopDebtorWorkspace
          query={debtorQuery}
          onQueryChange={setDebtorQuery}
          debouncedQuery={debouncedDebtorQuery}
          monthActive={debtorMonthActive}
          onSelectAllTime={() => setDebtorMonthActive(false)}
          onSelectMonth={() => setDebtorMonthActive(true)}
          month={debtorMonth}
          onMonthChange={setDebtorMonth}
          overdueOnly={debtorOverdueOnly}
          onToggleOverdueOnly={() => setDebtorOverdueOnly((v) => !v)}
          items={debtorItems}
          clientsLoading={debtorItemsLoading}
          notificationCount={notificationCount}
          onDelete={deleteClient.requestDelete}
          showPaymentAction
        />
      </div>

      <DeleteClientConfirmDialog deleteClient={deleteClient} />
    </PageTransition>
  );
}
