'use client';

// Utilisateurs — no Banani mockup for this page (only the dashboard was
// designed); styled to match its tokens/table idiom. Wraps the existing
// GET /api/admin/users route; row actions (role, suspend/delete, cancel
// subscription) live in AdminUserManagePanel — confirmed with the user as
// a modal "Gérer" panel rather than a per-user page.
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useToast } from '@/contexts/ToastContext';
import { PageTransition } from '@/components/jurali/PageTransition';
import { Icon } from '@/components/jurali/Icon';
import { Skeleton } from '@/components/jurali/Skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatusPill } from '@/components/admin/AdminStatusPill';
import {
  AdminUserManagePanel,
  type ManagedUser,
  type UserRole,
} from '@/components/admin/AdminUserManagePanel';
import { formatDateFr } from '@/lib/jurali-format';

interface ListResponse {
  items: ManagedUser[];
  nextCursor: string | null;
}

interface AdminMe {
  admin: { id: string; role: UserRole };
}

const STATUS_LABEL: Record<ManagedUser['status'], string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  DELETED: 'Supprimé',
};

export default function AdminUsersPage() {
  const { data: me } = useApi<AdminMe>('/api/admin/me');
  const isSuperadmin = me?.admin.role === 'SUPERADMIN';
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState<ManagedUser | null>(null);

  async function load(reset: boolean, cursorOverride?: string | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const c = reset ? null : (cursorOverride ?? cursor);
      if (c) params.set('cursor', c);
      params.set('limit', '30');
      const res = await api<ListResponse>(`/api/admin/users?${params.toString()}`);
      setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, []);

  return (
    <PageTransition>
      <AdminPageHeader
        title="Utilisateurs"
        subtitle={`${items.length}${hasMore ? '+' : ''} comptes`}
        action={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(true);
            }}
            className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2"
          >
            <Icon i="search" size={14} className="text-muted-foreground flex-shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Email ou nom…"
              className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-32 sm:w-48"
            />
          </form>
        }
      />

      <div className="px-4 lg:px-8 py-6 lg:py-7">
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {loading && items.length === 0
              ? Array.from({ length: 6 }, (_, i) => <UserRowSkeleton key={i} />)
              : items.map((u) => <UserRow key={u.id} user={u} onManage={() => setManaging(u)} />)}
            {!loading && items.length === 0 && (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                Aucun utilisateur ne correspond.
              </div>
            )}
          </div>
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading}
            className="mt-4 w-full sm:w-auto self-start bg-input border border-border text-foreground font-headings font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Chargement…' : 'Charger plus'}
          </button>
        )}
      </div>

      {managing && (
        <AdminUserManagePanel
          user={managing}
          isSuperadmin={isSuperadmin}
          onClose={() => setManaging(null)}
          onChanged={() => void load(true)}
        />
      )}
    </PageTransition>
  );
}

function UserRow({ user, onManage }: { user: ManagedUser; onManage: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="font-headings font-bold text-sm text-foreground truncate">
          {user.name || user.email}
        </div>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <AdminStatusPill
          label={user.role}
          tone={
            user.role === 'SUPERADMIN' ? 'warning' : user.role === 'ADMIN' ? 'positive' : 'neutral'
          }
        />
        <AdminStatusPill
          label={STATUS_LABEL[user.status]}
          tone={
            user.status === 'ACTIVE'
              ? 'positive'
              : user.status === 'SUSPENDED'
                ? 'warning'
                : 'danger'
          }
        />
        <span className="text-xs text-muted-foreground">{formatDateFr(user.createdAt)}</span>
      </div>
      <button
        type="button"
        onClick={onManage}
        className="flex-shrink-0 text-xs font-headings font-bold text-primary bg-secondary px-3 py-1.5 rounded-lg"
      >
        Gérer
      </button>
    </div>
  );
}

function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-52" />
      </div>
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-7 w-16 rounded-lg" />
    </div>
  );
}
