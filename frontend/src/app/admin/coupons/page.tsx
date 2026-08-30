'use client';

// Coupons — Premium checkout discount codes. No Banani mockup; styled to
// match /admin/subscriptions's tokens (its PriceCard is the closest
// analog: a money-affecting SUPERADMIN-only mutation on a simple list
// page). Any ADMIN can view the list; only SUPERADMIN sees the creation
// form and the activate/deactivate toggle — mirrors the Premium price
// edit bar.
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAsyncAction } from '@/lib/useAsyncAction';
import { useToast } from '@/contexts/ToastContext';
import { PageTransition } from '@/components/jurali/PageTransition';
import { Icon } from '@/components/jurali/Icon';
import { Skeleton } from '@/components/jurali/Skeleton';
import { ConfirmDialog } from '@/components/jurali/ConfirmDialog';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatusPill } from '@/components/admin/AdminStatusPill';
import { formatDateFr } from '@/lib/jurali-format';

type Role = 'ADMIN' | 'SUPERADMIN';

interface CouponRow {
  id: string;
  code: string;
  percentOff: number;
  active: boolean;
  expiresAt: string | null;
  redemptionCount: number;
  createdAt: string;
  createdBy: { email: string };
}

interface AdminMe {
  admin: { role: Role };
}

const ERROR_MESSAGES: Record<string, string> = {
  COUPON_CODE_TAKEN: 'Un coupon avec ce code existe déjà.',
  VALIDATION_FAILED: 'Vérifie le code (lettres/chiffres uniquement) et le pourcentage (1-100).',
};

function isExpired(expiresAt: string | null): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= Date.now();
}

export default function AdminCouponsPage() {
  const { data: me } = useApi<AdminMe>('/api/admin/me');
  const isSuperadmin = me?.admin.role === 'SUPERADMIN';

  const [items, setItems] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await api<{ items: CouponRow[] }>('/api/admin/coupons');
      setItems(res.items);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageTransition>
      <AdminPageHeader title="Coupons" subtitle="Codes de réduction pour l'abonnement Premium" />

      <div className="px-4 lg:px-8 py-6 lg:py-7 flex flex-col gap-6">
        {isSuperadmin && <CreateCouponCard onCreated={load} />}

        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {loading && items.length === 0
              ? Array.from({ length: 4 }, (_, i) => <CouponRowSkeleton key={i} />)
              : items.map((c) => (
                  <CouponListRow key={c.id} coupon={c} canManage={isSuperadmin} onChanged={load} />
                ))}
            {!loading && items.length === 0 && (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                Aucun coupon pour le moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function CreateCouponCard({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const { pending, run } = useAsyncAction();
  const [code, setCode] = useState('');
  const [percentOff, setPercentOff] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  async function submit() {
    const pct = Number.parseInt(percentOff, 10);
    if (!code.trim()) {
      toast('Entre un code.', 'error');
      return;
    }
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      toast('Le pourcentage doit être entre 1 et 100.', 'error');
      return;
    }
    await run(
      async () => {
        await api('/api/admin/coupons', {
          method: 'POST',
          body: {
            code: code.trim(),
            percentOff: pct,
            ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
          },
        });
        setCode('');
        setPercentOff('');
        setExpiresAt('');
        toast('Coupon créé.', 'success');
        onCreated();
      },
      (err) => {
        const message =
          err instanceof ApiError ? (ERROR_MESSAGES[err.code] ?? err.message) : 'Erreur réseau.';
        toast(message, 'error');
        return message;
      },
    );
  }

  return (
    <div className="bg-primary rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon i="tag" size={16} className="text-accent" />
        <span className="font-headings font-bold text-sm text-secondary uppercase tracking-widest">
          Nouveau coupon
        </span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <label className="flex-1 flex flex-col gap-1.5">
          <span className="text-xs text-secondary">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SUMMER20"
            maxLength={32}
            className="bg-primary-foreground/10 rounded-lg px-4 py-2.5 text-sm font-headings font-bold text-primary-foreground placeholder-secondary outline-none"
          />
        </label>
        <label className="w-full sm:w-28 flex flex-col gap-1.5">
          <span className="text-xs text-secondary">% de réduction</span>
          <input
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value.replace(/\D/g, '').slice(0, 3))}
            inputMode="numeric"
            placeholder="20"
            className="bg-primary-foreground/10 rounded-lg px-4 py-2.5 text-sm font-headings font-bold text-primary-foreground placeholder-secondary outline-none"
          />
        </label>
        <label className="w-full sm:w-44 flex flex-col gap-1.5">
          <span className="text-xs text-secondary">Expiration (optionnel)</span>
          <input
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            type="date"
            className="bg-primary-foreground/10 rounded-lg px-4 py-2.5 text-sm font-headings font-bold text-primary-foreground outline-none"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex-shrink-0 bg-accent text-accent-foreground font-headings font-bold text-sm px-5 py-2.5 rounded-lg disabled:opacity-60"
        >
          {pending ? 'Création…' : 'Créer'}
        </button>
      </div>
    </div>
  );
}

function CouponListRow({
  coupon,
  canManage,
  onChanged,
}: {
  coupon: CouponRow;
  canManage: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { pending, run } = useAsyncAction();
  const [confirming, setConfirming] = useState(false);
  const expired = isExpired(coupon.expiresAt);
  const effectivelyActive = coupon.active && !expired;

  async function toggle() {
    await run(
      async () => {
        await api(`/api/admin/coupons/${coupon.id}`, {
          method: 'PATCH',
          body: { active: !coupon.active },
        });
        setConfirming(false);
        toast(coupon.active ? 'Coupon désactivé.' : 'Coupon réactivé.', 'success');
        onChanged();
      },
      (err) => {
        const message = err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.';
        toast(message, 'error');
        setConfirming(false);
        return message;
      },
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-headings font-bold text-sm text-foreground">{coupon.code}</span>
          <AdminStatusPill
            label={expired ? 'Expiré' : coupon.active ? 'Actif' : 'Inactif'}
            tone={effectivelyActive ? 'positive' : expired ? 'neutral' : 'warning'}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          -{coupon.percentOff}% · {coupon.redemptionCount} utilisation
          {coupon.redemptionCount > 1 ? 's' : ''} · créé par {coupon.createdBy.email}
          {coupon.expiresAt && <> · expire le {formatDateFr(coupon.expiresAt)}</>}
        </div>
      </div>
      {canManage && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className={`flex-shrink-0 text-xs font-headings font-bold px-3 py-2 rounded-lg border disabled:opacity-50 ${
            coupon.active ? 'border-danger/40 text-danger' : 'border-primary/40 text-primary'
          }`}
        >
          {coupon.active ? 'Désactiver' : 'Réactiver'}
        </button>
      )}

      <ConfirmDialog
        open={confirming}
        title={coupon.active ? 'Désactiver ce coupon ?' : 'Réactiver ce coupon ?'}
        message={
          coupon.active
            ? `${coupon.code} ne pourra plus être appliqué à un nouveau paiement.`
            : `${coupon.code} redevient utilisable au checkout Premium.`
        }
        confirmLabel={coupon.active ? 'Désactiver' : 'Réactiver'}
        variant={coupon.active ? 'danger' : 'default'}
        icon="tag"
        onCancel={() => setConfirming(false)}
        onConfirm={toggle}
      />
    </div>
  );
}

function CouponRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  );
}
