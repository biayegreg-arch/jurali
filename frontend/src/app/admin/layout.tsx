'use client';

// Admin console shell — Banani's AdminDashboard.jsx sidebar, productionized
// from the starter's examples/frontend-pages/admin/layout.tsx reference
// (real GET /api/admin/me check + redirect, replacing the stub). Wraps
// every /admin/* page so the auth-gate + nav live in one place.
//
// Mobile-first: Banani only designed a desktop (1280px) mockup, so the
// fixed 260px sidebar is `hidden lg:flex`; below that a topbar + slide-in
// drawer (reusing the same AdminSidebarNav) stands in for it.
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/components/jurali/Icon';
import { ConfirmDialog } from '@/components/jurali/ConfirmDialog';
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav';

interface AdminMe {
  admin: { id: string; email: string; role: 'ADMIN' | 'SUPERADMIN' };
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { data, loading } = useApi<AdminMe>('/api/admin/me');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Both 401 (not logged in) and 403 (logged in but not ADMIN+) land on the
  // same GET /api/admin/me failure, surfaced by useApi as `data: null`.
  // This app has no dedicated admin login screen, so either case just
  // bounces a non-admin visitor home rather than showing a raw 403 page.
  useEffect(() => {
    if (!loading && !data) router.replace('/');
  }, [loading, data, router]);

  if (loading || !data) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Vérification des accès…</span>
      </div>
    );
  }

  const admin = data.admin;

  return (
    <div className="min-h-dvh bg-background font-body flex">
      {/* Desktop sidebar — Banani AdminDashboard.jsx, width:260 */}
      <div className="hidden lg:flex flex-col flex-shrink-0 border-r border-border bg-background w-[260px]">
        <SidebarHeader />
        <AdminSidebarNav />
        <SidebarFooter
          email={admin.email}
          role={admin.role}
          onLogout={() => setShowLogoutConfirm(true)}
        />
      </div>

      {/* Mobile topbar + drawer */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Icon i="zap" size={14} className="text-primary-foreground" />
          </div>
          <span className="font-headings font-bold text-base text-foreground">Console Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="w-10 h-10 rounded-lg bg-input border border-border flex items-center justify-center"
        >
          <Icon i="menu" size={18} className="text-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            role="presentation"
            onClick={() => setDrawerOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-foreground/40"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2 }}
              className="h-full w-[260px] bg-background border-r border-border flex flex-col"
            >
              <SidebarHeader />
              <AdminSidebarNav onNavigate={() => setDrawerOpen(false)} />
              <SidebarFooter
                email={admin.email}
                role={admin.role}
                onLogout={() => {
                  setDrawerOpen(false);
                  setShowLogoutConfirm(true);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</main>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Se déconnecter ?"
        message="Tu quitteras la console admin et ta session Jurali."
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        variant="danger"
        icon="log-out"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          void logout();
        }}
      />
    </div>
  );
}

function SidebarHeader() {
  return (
    <div className="px-6 pt-8 pb-6 border-b border-border hidden lg:block">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <Icon i="zap" size={14} className="text-primary-foreground" />
        </div>
        <span className="font-headings font-bold text-lg text-foreground">Jurali</span>
      </div>
      <div className="text-xs text-muted-foreground">Console Admin</div>
    </div>
  );
}

function SidebarFooter({
  email,
  role,
  onLogout,
}: {
  email: string;
  role: 'ADMIN' | 'SUPERADMIN';
  onLogout: () => void;
}) {
  return (
    <div className="mt-auto px-3 pb-6 pt-4 border-t border-border">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
          <span className="font-headings font-bold text-xs text-secondary-foreground">
            {email.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-headings font-bold text-xs text-foreground truncate">{email}</div>
          <div className="text-xs text-muted-foreground">
            {role === 'SUPERADMIN' ? 'Super Admin' : 'Admin'}
          </div>
        </div>
        <button type="button" onClick={onLogout} aria-label="Se déconnecter" className="p-1">
          <Icon i="log-out" size={14} className="text-muted-foreground flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}
