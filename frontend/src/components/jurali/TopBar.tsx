// Shared primary top bar (shop identity + the 2 SummaryStat tiles) used by
// the Dashboard and Liste des débiteurs screens — identical in both Banani
// sources (JuraliDashboard.jsx / DashboardAll.jsx), extracted here rather
// than duplicated.
import Link from 'next/link';
import { Icon } from './Icon';
import { SummaryStat } from './SummaryStat';
import { formatPrice } from '@/lib/utils';
import { useApi } from '@/lib/useApi';

export interface TopBarProps {
  email: string;
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  loading: boolean;
}

export function TopBar({
  email,
  totalDueFcfa,
  debtorCount,
  overdueDueFcfa,
  overdueDebtorCount,
  loading,
}: TopBarProps) {
  return (
    <div className="bg-primary px-4 pt-10 pb-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs text-secondary font-body mb-0.5">Boutique</div>
          {/* Phase 6 (phone+password signup) adds a real shop-owner name field. */}
          <div className="font-headings font-bold text-xl text-primary-foreground">{email}</div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <span className="font-headings font-bold text-sm text-secondary-foreground">
              {email.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <SummaryStat
          label="Total dû"
          value={loading ? '…' : formatPrice(totalDueFcfa)}
          sub={loading ? '' : `${debtorCount} clients`}
          accent
        />
        <SummaryStat
          label="En retard"
          value={loading ? '…' : formatPrice(overdueDueFcfa)}
          sub={loading ? '' : `${overdueDebtorCount} urgents`}
        />
      </div>
    </div>
  );
}

function NotificationBell() {
  const { data } = useApi<{ count: number }>('/api/notifications/count');
  const count = data?.count ?? 0;

  return (
    <Link
      href="/notifications"
      className="relative w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
    >
      <Icon i="bell" size={16} className="text-primary" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-headings font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
