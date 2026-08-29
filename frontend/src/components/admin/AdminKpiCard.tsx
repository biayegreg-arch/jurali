import { Icon } from '@/components/jurali/Icon';
import { AnimatedNumber } from '@/components/jurali/AnimatedNumber';
import { formatPrice } from '@/lib/utils';

export interface AdminKpiCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  iconBg?: string;
  iconColor?: string;
  format?: (n: number) => string;
  loading?: boolean;
}

/** KPI tile shared by /admin and /admin/revenue — Banani AdminDashboard.jsx. */
export function AdminKpiCard({
  label,
  value,
  suffix,
  icon,
  iconBg = 'bg-secondary',
  iconColor = 'text-secondary-foreground',
  format = (n) => formatPrice(n),
  loading = false,
}: AdminKpiCardProps) {
  return (
    <div className="bg-background border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon i={icon} size={14} className={iconColor} />
        </div>
      </div>
      <div className="font-headings font-bold text-3xl text-foreground">
        {loading ? '…' : <AnimatedNumber value={value} format={format} />}
        {!loading && suffix ? (
          <span className="text-base font-body font-normal">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}
