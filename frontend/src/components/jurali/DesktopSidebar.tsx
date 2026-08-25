import Link from 'next/link';
import { Icon } from './Icon';
import { formatPrice } from '@/lib/utils';

// Desktop (lg+) sidebar for /clients — Banani's "Dashboard Desktop"
// screen (DashboardDesktopWithMonthPicker.jsx), scoped to this one page
// only (not a global app shell — confirmed decision, see
// .planning/banani/debtor-list.md § Desktop sidebar + table). "Statistiques"
// dropped: no such page exists anywhere in the app.
export interface DesktopSidebarProps {
  displayName: string;
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  loading: boolean;
  overdueOnly: boolean;
  onSelectAll: () => void;
  onSelectOverdue: () => void;
}

export function DesktopSidebar({
  displayName,
  totalDueFcfa,
  debtorCount,
  overdueDueFcfa,
  overdueDebtorCount,
  loading,
  overdueOnly,
  onSelectAll,
  onSelectOverdue,
}: DesktopSidebarProps) {
  return (
    <div className="hidden lg:flex bg-primary flex-col w-[280px] flex-shrink-0 min-h-dvh">
      <div className="px-6 pt-10 pb-8 border-b border-primary-foreground/10">
        <div className="text-xs text-secondary font-body mb-1">Boutique</div>
        <div className="font-headings font-bold text-xl text-primary-foreground mb-4 truncate">
          {displayName}
        </div>
        <Link href="/settings" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
            <span className="font-headings font-bold text-sm text-primary-foreground">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-headings font-bold text-sm text-primary-foreground truncate">
            Paramètres du compte
          </span>
        </Link>
      </div>

      <nav className="px-4 pt-6 flex flex-col gap-1">
        <button
          type="button"
          onClick={onSelectAll}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-body font-bold text-sm text-left ${
            !overdueOnly ? 'bg-primary-foreground/15' : ''
          }`}
        >
          <Icon i="users" size={18} className="text-primary-foreground flex-shrink-0" />
          <span className="text-primary-foreground">Débiteurs</span>
        </button>
        <button
          type="button"
          onClick={onSelectOverdue}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm text-left ${
            overdueOnly ? 'bg-primary-foreground/15 font-bold' : ''
          }`}
        >
          <Icon i="clock" size={18} className="text-secondary flex-shrink-0" />
          <span className="text-secondary">En retard</span>
        </button>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm"
        >
          <Icon i="settings" size={18} className="text-secondary flex-shrink-0" />
          <span className="text-secondary">Paramètres</span>
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
