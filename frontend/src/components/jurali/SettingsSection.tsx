import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide">
        {title}
      </div>
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export interface SettingsRowProps {
  icon: string;
  label: string;
  description?: string;
  value?: string;
  last?: boolean;
}

/** A static, non-interactive settings row — no toggle/action, informational only. */
export function SettingsRow({ icon, label, description, value, last = false }: SettingsRowProps) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${!last ? 'border-b border-border' : ''}`}>
      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
        <Icon i={icon} size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-headings font-bold text-sm text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      {value && <span className="text-sm text-muted-foreground flex-shrink-0">{value}</span>}
    </div>
  );
}
