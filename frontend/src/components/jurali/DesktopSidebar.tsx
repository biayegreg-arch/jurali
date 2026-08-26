'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { formatPrice } from '@/lib/utils';

// Desktop (lg+) sidebar shared by /clients, /dashboard, /debts/new and
// /stats — Banani's "Dashboard Desktop" screen family, scoped to these
// pages only (not a global app shell — confirmed decision, see
// .planning/banani/debtor-list.md § Desktop sidebar + table).
//
// The nav is plain ROUTE navigation (active state from `usePathname()`),
// not page-local filter toggles: /clients and /dashboard each own their
// own "Tous / Ce mois / En retard" filtering in `DesktopDebtorWorkspace`'s
// own row, so the sidebar doesn't need per-page callback props to stay
// reusable on pages with no debtor-filtering concept at all (2026-08-26).
export interface DesktopSidebarProps {
  displayName: string;
  /** Real `User.name` (phone-signup always collects it; Google OAuth sets
   * it from the ID token). Falls back to `displayName` when null — never
   * a fabricated placeholder name. */
  fullName: string | null;
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  loading: boolean;
}

export function DesktopSidebar({
  displayName,
  fullName,
  totalDueFcfa,
  debtorCount,
  overdueDueFcfa,
  overdueDebtorCount,
  loading,
}: DesktopSidebarProps) {
  const pathname = usePathname();
  const firstName = fullName?.trim().split(/\s+/)[0] || displayName;
  // "Débiteurs" represents the whole debtor-list experience, which both
  // /clients and /dashboard now render identically at lg+ (see
  // dashboard.md § Desktop sidebar + table) — highlight it on either.
  const onDebtorsPage = pathname === '/clients' || pathname === '/dashboard';

  return (
    <div className="hidden lg:flex bg-primary flex-col w-[280px] flex-shrink-0 min-h-dvh">
      <div className="px-6 pt-10 pb-8 border-b border-primary-foreground/10">
        <div className="text-xs text-secondary font-body mb-1">Boutique</div>
        <div className="font-headings font-bold text-xl text-primary-foreground mb-4 truncate">
          {displayName}
        </div>
        {/* Sole path to /settings in this sidebar (2026-08-26): a separate
            "Paramètres" nav item used to duplicate this exact link — removed
            rather than kept alongside it. */}
        <Link
          href="/settings"
          className={`flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-lg ${
            pathname === '/settings' ? 'bg-primary-foreground/15' : ''
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
            <span className="font-headings font-bold text-sm text-primary-foreground">
              {firstName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-headings font-bold text-sm text-primary-foreground truncate">
              {firstName}
            </div>
            {/* Every Jurali account is a single-owner shop (no
                multi-tenancy/roles) — "Propriétaire" is always accurate,
                not a fabricated placeholder like a fake avatar photo
                would be. */}
            <div className="text-xs text-secondary">Propriétaire</div>
          </div>
        </Link>
      </div>

      <nav className="px-4 pt-6 flex flex-col gap-1">
        <Link
          href="/clients"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-body font-bold text-sm ${
            onDebtorsPage ? 'bg-primary-foreground/15' : ''
          }`}
        >
          <Icon i="users" size={18} className="text-primary-foreground flex-shrink-0" />
          <span className="text-primary-foreground">Débiteurs</span>
        </Link>
        <Link
          href="/clients?filter=overdue"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm"
        >
          <Icon i="clock" size={18} className="text-secondary flex-shrink-0" />
          <span className="text-secondary">En retard</span>
        </Link>
        <Link
          href="/stats"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm ${
            pathname === '/stats' ? 'bg-primary-foreground/15 font-bold' : ''
          }`}
        >
          <Icon i="bar-chart-2" size={18} className="text-secondary flex-shrink-0" />
          <span className="text-secondary">Statistiques</span>
        </Link>
      </nav>

      <div className="px-4 mt-8 flex flex-col gap-3">
        <SidebarStat
          label="Total dû"
          value={loading ? '…' : formatPrice(totalDueFcfa)}
          sub={loading ? '' : `${debtorCount} clients`}
        />
        <SidebarStat
          label="En retard"
          value={loading ? '…' : formatPrice(overdueDueFcfa)}
          sub={loading ? '' : `${overdueDebtorCount} urgents`}
        />
      </div>

      <div className="px-4 mt-auto pb-8 pt-6">
        <Link
          href="/debts/new"
          className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-3.5 rounded-xl"
        >
          <Icon i="plus" size={20} />
          Nouvelle dette
        </Link>
      </div>
    </div>
  );
}

// Not `SummaryStat`: that component's `accent` variant uses `bg-primary`,
// which is invisible against this sidebar's own `bg-primary` background
// (a contrast bug in the Banani source — it reuses the light-page tile on
// a dark panel). Same semi-transparent-white treatment already used for
// the stat card on /signup's dark brand panel.
function SidebarStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl px-4 py-3 bg-primary-foreground/10">
      <div className="text-xs font-body mb-1 text-secondary">{label}</div>
      <div className="font-headings font-bold text-2xl leading-none text-primary-foreground">
        {value}
      </div>
      <div className="text-xs mt-1 font-body text-secondary">FCFA{sub ? ` · ${sub}` : ''}</div>
    </div>
  );
}
