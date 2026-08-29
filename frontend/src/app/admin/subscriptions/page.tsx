'use client';

// Abonnements — no Banani mockup (only the dashboard was designed); styled
// to match its tokens. Two concerns: the subscriptions list (new GET
// /api/admin/subscriptions) and the admin-editable Premium price (new
// GET/PATCH /api/admin/config, SUPERADMIN-only — see admin-console.md for
// why this needed a dedicated PlatformConfig table instead of just editing
// the old hardcoded constant).
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi, invalidateAllCache } from '@/lib/useApi';
import { useAsyncAction } from '@/lib/useAsyncAction';
import { useToast } from '@/contexts/ToastContext';
import { PageTransition } from '@/components/jurali/PageTransition';
import { Icon } from '@/components/jurali/Icon';
import { Skeleton } from '@/components/jurali/Skeleton';
import { ConfirmDialog } from '@/components/jurali/ConfirmDialog';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatusPill, type AdminStatusTone } from '@/components/admin/AdminStatusPill';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';

type Role = 'ADMIN' | 'SUPERADMIN';
type SubStatus = 'PENDING' | 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'FAILED';

interface SubscriptionRow {
  id: string;
  ownerId: string;
  status: SubStatus;
  renewsAt: string | null;
  planAmountFcfa: number;
  paymentMethod: string | null;
  createdAt: string;
  isActive: boolean;
  owner: { email: string; name: string | null; shopName: string | null };
}

interface ListResponse {
  items: SubscriptionRow[];
  nextCursor: string | null;
}

interface AdminMe {
  admin: { role: Role };
}

interface ConfigResponse {
  premiumMonthlyPriceFcfa: number;
  updatedAt: string | null;
}

const STATUS_TONE: Record<SubStatus, AdminStatusTone> = {
  ACTIVE: 'positive',
  PENDING: 'warning',
  CANCELED: 'neutral',
  EXPIRED: 'neutral',
  FAILED: 'danger',
};
const STATUS_LABEL: Record<SubStatus, string> = {
  ACTIVE: 'Actif',
  PENDING: 'En attente',
  CANCELED: 'Résilié',
  EXPIRED: 'Expiré',
  FAILED: 'Échoué',
};

export default function AdminSubscriptionsPage() {
  const { data: me } = useApi<AdminMe>('/api/admin/me');
  const isSuperadmin = me?.admin.role === 'SUPERADMIN';

  const [status, setStatus] = useState<SubStatus | ''>('');
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', '30');
      const res = await api<ListResponse>(`/api/admin/subscriptions?${params.toString()}`);
      setItems(res.items);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  return (
    <PageTransition>
      <AdminPageHeader title="Abonnements" subtitle="Prix Premium et abonnés" />

      <div className="px-4 lg:px-8 py-6 lg:py-7 flex flex-col gap-6">
        <PriceCard editable={isSuperadmin} />

        <div className="flex items-center justify-between gap-3">
          <div className="font-headings font-bold text-base text-foreground">Abonnés</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubStatus | '')}
            className="text-sm bg-input border border-border rounded-lg px-3 py-2 text-foreground"
          >
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUS_LABEL) as SubStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {loading && items.length === 0
              ? Array.from({ length: 6 }, (_, i) => <SubscriptionRowSkeleton key={i} />)
              : items.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-headings font-bold text-sm text-foreground truncate">
                        {s.owner.shopName || s.owner.name || s.owner.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.owner.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AdminStatusPill
                        label={s.isActive ? 'Actif' : STATUS_LABEL[s.status]}
                        tone={s.isActive ? 'positive' : STATUS_TONE[s.status]}
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(s.planAmountFcfa)} FCFA
                      </span>
                      {s.renewsAt && (
                        <span className="text-xs text-muted-foreground">
                          → {formatDateFr(s.renewsAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            {!loading && items.length === 0 && (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                Aucun abonnement ne correspond.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function PriceCard({ editable }: { editable: boolean }) {
  const { data: config, refresh } = useApi<ConfigResponse>('/api/admin/config');
  const { toast } = useToast();
  const { pending, run } = useAsyncAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<number | null>(null);

  function startEdit() {
    setDraft(String(config?.premiumMonthlyPriceFcfa ?? ''));
    setEditing(true);
  }

  function requestSave() {
    const value = Number.parseInt(draft, 10);
    if (!Number.isFinite(value) || value < 100 || value > 100_000) {
      toast('Le prix doit être entre 100 et 100 000 FCFA.', 'error');
      return;
    }
    setConfirming(value);
  }

  async function confirmSave() {
    const value = confirming;
    if (value === null) return;
    await run(
      async () => {
        await api('/api/admin/config', {
          method: 'PATCH',
          body: { premiumMonthlyPriceFcfa: value },
        });
        invalidateAllCache();
        await refresh();
        setEditing(false);
        setConfirming(null);
        toast('Prix mis à jour.', 'success');
      },
      (err) => {
        const message = err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.';
        toast(message, 'error');
        setConfirming(null);
        return message;
      },
    );
  }

  return (
    <div className="bg-primary rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon i="credit-card" size={16} className="text-accent" />
          <span className="font-headings font-bold text-sm text-secondary uppercase tracking-widest">
            Prix Premium mensuel
          </span>
        </div>
        {editable && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-headings font-bold text-primary-foreground bg-primary-foreground/10 px-3 py-1.5 rounded-lg"
          >
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-4 py-2.5 flex-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="bg-transparent text-lg font-headings font-bold text-primary-foreground outline-none w-full"
            />
            <span className="text-sm text-secondary flex-shrink-0">FCFA</span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 sm:flex-none bg-primary-foreground/10 text-primary-foreground font-headings font-bold text-sm px-4 py-2.5 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={requestSave}
              className="flex-1 sm:flex-none bg-accent text-accent-foreground font-headings font-bold text-sm px-4 py-2.5 rounded-lg"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : !config ? (
        <Skeleton className="h-9 w-40 bg-primary-foreground/15" />
      ) : (
        <>
          <div className="font-headings font-bold text-3xl text-primary-foreground">
            {formatPrice(config.premiumMonthlyPriceFcfa)}{' '}
            <span className="text-base font-body font-normal text-secondary">FCFA / mois</span>
          </div>
          {config.updatedAt && (
            <div className="text-xs text-secondary mt-2">
              Dernière modification : {formatDateFr(config.updatedAt)}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="Modifier le prix Premium ?"
        message={`Le nouveau prix (${confirming !== null ? formatPrice(confirming) : ''} FCFA) s'appliquera à tous les nouveaux abonnements et renouvellements. Les abonnés déjà actifs gardent leur prix actuel jusqu'à leur prochain renouvellement.`}
        confirmLabel={pending ? 'Enregistrement…' : 'Confirmer'}
        icon="credit-card"
        onCancel={() => setConfirming(null)}
        onConfirm={confirmSave}
      />
    </div>
  );
}

function SubscriptionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
