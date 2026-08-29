import type { ReactNode } from 'react';

export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 lg:px-8 pt-5 lg:pt-7 pb-5 border-b border-border">
      <div className="min-w-0">
        <div className="font-headings font-bold text-xl lg:text-2xl text-foreground truncate">
          {title}
        </div>
        {subtitle && <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
