// Shared primary top bar (shop identity + the 2 SummaryStat tiles) used by
// the Dashboard and Liste des débiteurs screens — identical in both Banani
// sources (JuraliDashboard.jsx / DashboardAll.jsx), extracted here rather
// than duplicated.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { SummaryStat } from './SummaryStat';
import { AnimatedNumber } from './AnimatedNumber';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { CLIENT_FREE_TIER_LIMIT } from '@/lib/server/jurali/client-limits';

export interface TopBarProps {
  /** Shop name (falls back to the account name, then email) — never the
   * raw phone-signup synthetic email (see AuthContext's `User.shopName`). */
  displayName: string;
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  loading: boolean;
  /** Pass when a sibling tree on the same page already fetches this (e.g.
   * a desktop bell rendered alongside this mobile bar) — avoids two
   * simultaneous `/api/notifications/count` fetches (useApi's cache isn't
   * dedup'd across concurrently-mounting instances). Omit to self-fetch. */
  notificationCount?: number;
  /** Every Client row regardless of balance — drives the free-tier "Passer
   * à Premium" nudge, mirroring DesktopSidebar's (mobile had none before,
   * a real parity gap since this is the free→paid upsell surface). */
  totalClientCount?: number;
  isPremium?: boolean;
}

export function TopBar({
  displayName,
  totalDueFcfa,
  debtorCount,
  overdueDueFcfa,
  overdueDebtorCount,
  loading,
  notificationCount,
  totalClientCount = 0,
  isPremium = false,
}: TopBarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  return (
    <div className="bg-primary px-4 pt-10 pb-5">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <div className="text-xs text-secondary font-body mb-0.5">Boutique</div>
            <div className="font-headings font-bold text-xl text-primary-foreground truncate">
              {displayName}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className="h-8 px-2.5 rounded-lg bg-secondary flex items-center gap-1"
              >
                <Icon i="shield" size={14} className="text-secondary-foreground" />
                <span className="font-headings font-bold text-xs text-secondary-foreground">
                  Admin
                </span>
              </Link>
            )}
            {/* Only entry point to /stats on mobile — DesktopSidebar's
                "Statistiques" nav item has no mobile equivalent otherwise,
                which made that whole page unreachable from a phone (mobile
                nav-parity audit, 2026-08-31). */}
            <Link
              href="/stats"
              aria-label="Statistiques"
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
            >
              <Icon i="bar-chart-2" size={15} className="text-secondary-foreground" />
            </Link>
            <NotificationBell count={notificationCount} />
            <Link
              href="/settings"
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
            >
              <span className="font-headings font-bold text-sm text-secondary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </Link>
          </div>
        </div>

        <div className="flex gap-3">
          <SummaryStat
            label="Total dû"
            value={loading ? '…' : <AnimatedNumber value={totalDueFcfa} />}
            sub={loading ? '' : `${debtorCount} clients`}
            accent
          />
          {/* Only entry point to /debts/overdue on mobile — DesktopSidebar's
              "En retard" nav item has no mobile equivalent otherwise, which
              made that whole page unreachable from a phone. */}
          <Link href="/debts/overdue" className="flex-1">
            <SummaryStat
              label="En retard"
              value={loading ? '…' : <AnimatedNumber value={overdueDueFcfa} />}
              sub={loading ? '' : `${overdueDebtorCount} urgents`}
            />
          </Link>
        </div>

        {!isPremium && (
          <Link
            href="/premium"
            className="mt-3 rounded-xl p-4 bg-primary-foreground/10 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <Icon i="crown" size={15} className="text-accent flex-shrink-0" />
              <span className="font-headings font-bold text-xs text-primary-foreground">
                Passer à Premium
              </span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden bg-primary-foreground/20">
              <div
                className="h-full bg-accent rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((totalClientCount / CLIENT_FREE_TIER_LIMIT) * 100))}%`,
                }}
              />
            </div>
            <p className="text-xs text-secondary">
              {totalClientCount} / {CLIENT_FREE_TIER_LIMIT} clients utilisés
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}

export function NotificationBell({
  count: countOverride,
}: {
  count?: number | undefined;
} = {}) {
  const { data } = useApi<{ count: number }>('/api/notifications/count', {
    skip: countOverride !== undefined,
  });
  const count = countOverride ?? data?.count ?? 0;
  const prevCount = useRef(count);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (count > prevCount.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 400);
      prevCount.current = count;
      return () => clearTimeout(timer);
    }
    prevCount.current = count;
    return undefined;
  }, [count]);

  return (
    <Link
      href="/notifications"
      className="relative w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
    >
      <motion.span animate={pulse ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.4 }}>
        <Icon i="bell" size={16} className="text-primary" />
      </motion.span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-headings font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
