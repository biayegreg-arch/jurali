// Maps Banani's <Icon i="kebab-case-name" size={n} className="..." />
// call signature onto lucide-react (the icon set every Banani screen was
// designed with). lucide-react's dynamic `icons` map is keyed PascalCase;
// most Banani names convert mechanically (chevron-left -> ChevronLeft),
// a few were renamed in this lucide-react major version and need an alias.
import { icons } from 'lucide-react';

const RENAMED: Record<string, keyof typeof icons> = {
  'bar-chart-2': 'ChartColumnIncreasing',
};

function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export interface IconProps {
  i: string;
  size?: number;
  className?: string;
}

export function Icon({ i, size = 20, className }: IconProps) {
  const name = RENAMED[i] ?? (toPascalCase(i) as keyof typeof icons);
  const LucideIcon = icons[name];
  if (!LucideIcon) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Icon: no lucide-react icon found for "${i}" (looked up "${name}")`);
    }
    return null;
  }
  return <LucideIcon size={size} className={className} />;
}
