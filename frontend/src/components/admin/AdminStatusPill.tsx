const TONES = {
  positive: 'bg-primary text-primary-foreground',
  neutral: 'bg-input border border-border text-muted-foreground',
  warning: 'bg-accent text-accent-foreground',
  danger: 'bg-danger/10 text-danger',
} as const;

export type AdminStatusTone = keyof typeof TONES;

/** Small status/plan badge reused across Users, Abonnements, Revenus, Notifications. */
export function AdminStatusPill({ label, tone }: { label: string; tone: AdminStatusTone }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md font-headings font-bold text-xs whitespace-nowrap ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
