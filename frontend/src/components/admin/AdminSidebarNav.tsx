'use client';

// Shared nav list — rendered both in the fixed desktop sidebar and inside
// the mobile drawer (AdminLayout) so active-state logic lives in one place.
// Items/icons match Banani's AdminDashboard.jsx sidebar exactly; the other
// 5 pages weren't in the Banani fetch (only the dashboard screen was
// designed) but their nav entries were named in its own sidebar, so this
// list is the single source of truth for the whole admin section.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/jurali/Icon';

export const ADMIN_NAV = [
  { href: '/admin', label: "Vue d'ensemble", icon: 'layout-dashboard' },
  { href: '/admin/users', label: 'Utilisateurs', icon: 'users' },
  { href: '/admin/subscriptions', label: 'Abonnements', icon: 'credit-card' },
  { href: '/admin/coupons', label: 'Coupons', icon: 'tag' },
  { href: '/admin/revenue', label: 'Revenus', icon: 'bar-chart-2' },
  { href: '/admin/notifications', label: 'Notifications', icon: 'message-circle' },
  { href: '/admin/settings', label: 'Paramètres', icon: 'settings' },
] as const;

export function AdminSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="px-3 pt-5 flex flex-col gap-0.5">
      {ADMIN_NAV.map((item) => {
        const active =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-body text-sm min-h-[44px] ${
              active ? 'bg-secondary text-secondary-foreground font-bold' : 'text-muted-foreground'
            }`}
          >
            <Icon i={item.icon} size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
