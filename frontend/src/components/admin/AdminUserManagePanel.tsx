'use client';

// "Gérer" panel — the single place an admin promotes a user to ADMIN,
// suspends/restores/soft-deletes their account, or force-cancels their
// Premium subscription. Deliberately a modal over the Utilisateurs list
// (not a dedicated /admin/users/[id] page) — confirmed with the user:
// faster to use from the list, no extra navigation.
//
// "Supprimer le compte" is a SOFT delete (User.status = 'DELETED') — data
// (Clients/Transactions/Subscription) is retained and the action is
// reversible via "Restaurer". A real cascading delete would permanently
// erase the shop owner's entire debt ledger; confirmed with the user this
// is NOT what's wanted here.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAsyncAction } from '@/lib/useAsyncAction';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/jurali/Icon';
import { ConfirmDialog } from '@/components/jurali/ConfirmDialog';
import { Skeleton } from '@/components/jurali/Skeleton';
import { AdminStatusPill, type AdminStatusTone } from '@/components/admin/AdminStatusPill';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';

export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

interface SubscriptionSummary {
  status: 'PENDING' | 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'FAILED';
  isActive: boolean;
  planAmountFcfa: number;
}

interface SubscriptionListResponse {
  items: SubscriptionSummary[];
}

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  DELETED: 'Supprimé',
};
const STATUS_TONE: Record<UserStatus, AdminStatusTone> = {
  ACTIVE: 'positive',
  SUSPENDED: 'warning',
  DELETED: 'danger',
};

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
}

export function AdminUserManagePanel({
  user,
  isSuperadmin,
  onClose,
  onChanged,
}: {
  user: ManagedUser;
  isSuperadmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const roleAction = useAsyncAction();
  const statusAction = useAsyncAction();
  const subAction = useAsyncAction();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const [sub, setSub] = useState<SubscriptionSummary | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    api<SubscriptionListResponse>(`/api/admin/subscriptions?ownerId=${user.id}&limit=1`)
      .then((res) => {
        if (!cancelled) setSub(res.items[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSub(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  function reportError(err: unknown): string {
    const message = err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.';
    toast(message, 'error');
    return message;
  }

  async function changeRole(role: UserRole) {
    await roleAction.run(async () => {
      await api(`/api/admin/users/${user.id}/role`, { method: 'PATCH', body: { role } });
      toast('Rôle mis à jour.', 'success');
      onChanged();
    }, reportError);
  }

  async function setStatus(status: UserStatus) {
    await statusAction.run(async () => {
      await api(`/api/admin/users/${user.id}/status`, { method: 'PATCH', body: { status } });
      toast(
        status === 'ACTIVE'
          ? 'Compte réactivé.'
          : status === 'SUSPENDED'
            ? 'Compte suspendu.'
            : 'Compte supprimé.',
        'success',
      );
      onChanged();
    }, reportError);
  }

  async function cancelSubscription() {
    await subAction.run(async () => {
      await api(`/api/admin/users/${user.id}/subscription/cancel`, { method: 'POST' });
      setSub((prev) => (prev ? { ...prev, status: 'CANCELED', isActive: false } : prev));
      toast('Abonnement Premium annulé.', 'success');
      onChanged();
    }, reportError);
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          role="presentation"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center px-4 py-8"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            className="bg-background border border-border rounded-xl w-full max-w-md max-h-full overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="min-w-0">
                <div className="font-headings font-bold text-base text-foreground truncate">
                  {user.name || user.email}
                </div>
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg bg-input border border-border flex items-center justify-center flex-shrink-0"
              >
                <Icon i="x" size={16} className="text-foreground" />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <AdminStatusPill
                  label={STATUS_LABEL[user.status]}
                  tone={STATUS_TONE[user.status]}
                />
                <AdminStatusPill
                  label={user.role}
                  tone={
                    user.role === 'SUPERADMIN'
                      ? 'warning'
                      : user.role === 'ADMIN'
                        ? 'positive'
                        : 'neutral'
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Inscrit le {formatDateFr(user.createdAt)}
                </span>
              </div>

              <section className="flex flex-col gap-2">
                <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground">
                  Rôle
                </div>
                {isSuperadmin ? (
                  <select
                    value={user.role}
                    disabled={roleAction.pending}
                    onChange={(e) => void changeRole(e.target.value as UserRole)}
                    className="text-sm bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </select>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Seul un SUPERADMIN peut changer le rôle.
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground">
                  Compte
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.status === 'ACTIVE' && (
                    <button
                      type="button"
                      disabled={statusAction.pending}
                      onClick={() =>
                        setConfirm({
                          title: 'Suspendre ce compte ?',
                          message: `${user.email} ne pourra plus se connecter jusqu'à réactivation. Réversible.`,
                          confirmLabel: 'Suspendre',
                          run: () => setStatus('SUSPENDED'),
                        })
                      }
                      className="text-xs font-headings font-bold px-3 py-2 rounded-lg border border-accent/40 text-accent-foreground bg-accent/10 disabled:opacity-50"
                    >
                      Suspendre
                    </button>
                  )}
                  {(user.status === 'SUSPENDED' || user.status === 'DELETED') && isSuperadmin && (
                    <button
                      type="button"
                      disabled={statusAction.pending}
                      onClick={() => void setStatus('ACTIVE')}
                      className="text-xs font-headings font-bold px-3 py-2 rounded-lg border border-primary/40 text-primary disabled:opacity-50"
                    >
                      Réactiver
                    </button>
                  )}
                  {user.status !== 'DELETED' && isSuperadmin && (
                    <button
                      type="button"
                      disabled={statusAction.pending}
                      onClick={() =>
                        setConfirm({
                          title: 'Supprimer ce compte ?',
                          message: `${user.email} sera bloqué à la connexion. Ses données (clients, dettes, abonnement) sont conservées — cette action reste réversible via "Réactiver".`,
                          confirmLabel: 'Supprimer',
                          run: () => setStatus('DELETED'),
                        })
                      }
                      className="text-xs font-headings font-bold px-3 py-2 rounded-lg border border-danger/40 text-danger disabled:opacity-50"
                    >
                      Supprimer le compte
                    </button>
                  )}
                </div>
                {!isSuperadmin && user.status !== 'ACTIVE' && (
                  <div className="text-xs text-muted-foreground">
                    Seul un SUPERADMIN peut réactiver ou supprimer un compte.
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground">
                  Abonnement Premium
                </div>
                {sub === undefined ? (
                  <Skeleton className="h-9 w-full" />
                ) : sub === null ? (
                  <div className="text-sm text-muted-foreground">Aucun abonnement.</div>
                ) : (
                  <div className="flex items-center justify-between gap-3 bg-input rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <AdminStatusPill
                        label={sub.isActive ? 'Actif' : sub.status}
                        tone={sub.isActive ? 'positive' : 'neutral'}
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(sub.planAmountFcfa)} FCFA/mois
                      </span>
                    </div>
                    {isSuperadmin && (sub.status === 'ACTIVE' || sub.status === 'PENDING') && (
                      <button
                        type="button"
                        disabled={subAction.pending}
                        onClick={() =>
                          setConfirm({
                            title: "Annuler l'abonnement Premium ?",
                            message: `${user.email} perd l'accès Premium immédiatement, même s'il lui reste des jours payés.`,
                            confirmLabel: 'Annuler l’abonnement',
                            run: cancelSubscription,
                          })
                        }
                        className="text-xs font-headings font-bold text-danger flex-shrink-0"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Confirmer'}
        variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm;
          setConfirm(null);
          await action?.run();
        }}
      />
    </>
  );
}
