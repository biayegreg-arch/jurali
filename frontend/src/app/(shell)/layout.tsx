'use client';

// Shared shell for the 11 authenticated dashboard-style pages (/dashboard,
// /clients + subpages, /debts/new, /debts/overdue, /premium/checkout,
// /premium/manage, /settings, /stats). Each of those pages used to render
// its own <DesktopSidebar> + wrap itself in <PageTransition> — since
// Next.js fully remounts a page's tree on every navigation, that meant the
// persistent-looking sidebar was actually unmounting and replaying its
// fade-in animation on every single click, which read as "the whole site
// reloads" (reported 2026-09-03). Hoisting the sidebar here, into a real
// Next.js layout, keeps ONE sidebar instance alive across navigations
// between these routes — no remount, no fade, no data refetch.
//
// Per-page fade-in animation (<PageTransition>) was deliberately dropped
// for exactly these 11 pages (confirmed with the user) rather than kept via
// a display:contents wrapper — the latter would have preserved layout but
// silently no-op'd the animation anyway (contents elements can't paint
// their own opacity), for no benefit over removing it outright. Other
// pages (auth, marketing) keep <PageTransition> untouched.
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  totalClientCount: number;
}

interface SubscriptionData {
  isActive: boolean;
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });

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
        totalClientCount={dashboard?.totalClientCount ?? 0}
        isPremium={subscription?.isActive ?? false}
      />
      {children}
    </div>
  );
}
