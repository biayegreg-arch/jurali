import { Icon } from './Icon';

// KPI card for /stats — Banani's `StatisticsDesktop` screen (3-card grid).
// Distinct from `SummaryStat` (sidebar tiles: compact, no icon box) — this
// one is bigger, has a top-right icon badge, and a "danger" tone for the
// overdue card, so it isn't worth merging into one over-configurable
// component (2 real screens, 2 real axes of variation each).
export interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  sub: string;
  icon: string;
  tone?: 'default' | 'danger' | 'primary';
}

const TONE_VALUE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-foreground',
  danger: 'text-danger',
  primary: 'text-primary',
};

const TONE_ICON_BOX_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-secondary text-secondary-foreground',
  danger: 'bg-danger/10 text-danger',
  primary: 'bg-secondary text-secondary-foreground',
};

export function StatCard({ label, value, unit, sub, icon, tone = 'default' }: StatCardProps) {
  return (
    <div className="bg-background border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className={`font-headings font-bold text-3xl mt-2 ${TONE_VALUE_CLASS[tone]}`}>
            {value}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{unit}</div>
        </div>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${TONE_ICON_BOX_CLASS[tone]}`}
        >
          <Icon i={icon} size={24} />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
