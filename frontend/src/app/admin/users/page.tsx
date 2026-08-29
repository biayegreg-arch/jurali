'use client';

// Utilisateurs — no Banani mockup for this page (only the dashboard was
// designed); styled to match its tokens/table idiom. Wraps the existing
// GET /api/admin/users + PATCH .../role + PATCH .../status routes (all
// already shipped, Phase 3) — this page is pure UI.
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAsyncAction } from '@/lib/useAsyncAction';
import { useToast } from '@/contexts/ToastContext';
import { PageTransition } from '@/components/jurali/PageTransition';
import { Icon } from '@/components/jurali/Icon';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatusPill } from '@/components/admin/AdminStatusPill';
import { formatDateFr } from '@/lib/jurali-format';

type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
type Status = 'ACTIVE' | 'SUSPENDED';

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: Status;
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface ListResponse {
  items: AdminUserRow[];
  nextCursor: string | null;
}

interface AdminMe {
  admin: { id: string; role: Role };
}

export default function AdminUsersPage() {
  const { data: me } = useApi<AdminMe>('/api/admin/me');
  const isSuperadmin = me?.admin.role === 'SUPERADMIN';
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

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
            {items.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSuperadmin={isSuperadmin}
                onChanged={() => load(true)}
              />
            ))}
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
    </PageTransition>
  );
}

function UserRow({
  user,
  isSuperadmin,
  onChanged,
}: {
  user: AdminUserRow;
  isSuperadmin: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const roleAction = useAsyncAction();
  const statusAction = useAsyncAction();

  async function changeRole(role: Role) {
    await roleAction.run(
      async () => {
        await api(`/api/admin/users/${user.id}/role`, { method: 'PATCH', body: { role } });
        toast('Rôle mis à jour.', 'success');
        onChanged();
      },
      (err) => {
        const message = err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.';
        toast(message, 'error');
        return message;
      },
    );
  }

  async function toggleStatus() {
    const next: Status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await statusAction.run(
      async () => {
        await api(`/api/admin/users/${user.id}/status`, {
          method: 'PATCH',
          body: { status: next },
        });
        toast(next === 'SUSPENDED' ? 'Compte suspendu.' : 'Compte réactivé.', 'success');
        onChanged();
      },
      (err) => {
        const message = err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.';
        toast(message, 'error');
        return message;
      },
    );
  }

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
          label={user.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
          tone={user.status === 'ACTIVE' ? 'positive' : 'danger'}
        />
        <span className="text-xs text-muted-foreground">{formatDateFr(user.createdAt)}</span>
      </div>
      {isSuperadmin && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={user.role}
            disabled={roleAction.pending}
            onChange={(e) => void changeRole(e.target.value as Role)}
            className="text-xs bg-input border border-border rounded-lg px-2 py-1.5 text-foreground"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>
          <button
            type="button"
            onClick={() => void toggleStatus()}
            disabled={statusAction.pending}
            className={`text-xs font-headings font-bold px-3 py-1.5 rounded-lg border ${
              user.status === 'ACTIVE'
                ? 'border-danger/30 text-danger'
                : 'border-primary/30 text-primary'
            } disabled:opacity-50`}
          >
            {user.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
          </button>
        </div>
      )}
    </div>
  );
}
