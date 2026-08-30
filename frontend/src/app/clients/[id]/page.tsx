'use client';

// Fiche client — PRD 3.6 / US-04. Mobile reproduces Banani's FicheClient.jsx
// (card-list layout); desktop (lg+) reproduces the later desktop redesign
// of the same screen (2026-08-26) — sidebar + 2-column layout with a debt
// history TABLE (filter tabs) instead of a card list. Both share the same
// fetched `client`/derived data — see .planning/banani/fiche-client.md.
import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useApi, invalidateAllCache } from '@/lib/useApi';
import { useAsyncAction } from '@/lib/useAsyncAction';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { NotificationBell } from '@/components/jurali/TopBar';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { DebtHistoryRow } from '@/components/jurali/DebtHistoryRow';
import { PageTransition } from '@/components/jurali/PageTransition';
import { AnimatedNumber } from '@/components/jurali/AnimatedNumber';
import { formatDateFr } from '@/lib/jurali-format';
import { formatPrice } from '@/lib/utils';
import {
  computeDebtStatuses,
  computeOverdueBalance,
  computePaymentProgress,
  oldestUnpaidDebtDate,
  type DebtTransaction,
  type DebtStatus,
  type PaymentProgress,
} from '@/lib/server/jurali/balance';
import { AUTO_REMINDER_THRESHOLD_DAYS } from '@/lib/server/jurali/auto-reminder';
import { downloadClientHistoryPdf } from '@/lib/jurali-pdf';

interface ClientTransaction {
  id: string;
  type: 'DEBT' | 'PAYMENT';
  amountFcfa: number;
  note: string | null;
  createdAt: string;
}

interface ClientDetail {
  id: string;
  firstName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  lastReminderSentAt: string | null;
  balanceFcfa: number;
  isOverdue: boolean;
  transactions: ClientTransaction[];
}

interface SubscriptionData {
  isActive: boolean;
}

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  totalClientCount: number;
}

export default function ClientFichePage() {
  const user = useUser();
  const params = useParams<{ id: string }>();
  const {
    data: client,
    loading,
    error,
    refresh,
  } = useApi<ClientDetail>(`/api/clients/${params.id}`);
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  const {
    data: dashboard,
    loading: dashboardLoading,
    refresh: refreshDashboard,
  } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });
  const isPremium = subscription?.isActive ?? false;
  const { data: autoReminderSettings } = useApi<{ enabled: boolean }>(
    '/api/settings/auto-reminders',
    { skip: !isPremium },
  );

  async function refreshAll() {
    invalidateAllCache();
    await Promise.all([refresh(), refreshDashboard()]);
  }

  if (!user) return null;

  const displayName = user.shopName || user.email;

  return (
    <PageTransition>
      <div className="min-h-dvh bg-background font-body flex flex-col lg:flex-row">
        <DesktopSidebar
          displayName={displayName}
          fullName={user.name}
          totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
          debtorCount={dashboard?.debtorCount ?? 0}
          overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
          overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
          loading={dashboardLoading}
          totalClientCount={dashboard?.totalClientCount ?? 0}
          isPremium={isPremium}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar (< lg) — unchanged */}
          <div className="bg-primary px-4 pt-10 pb-6 lg:hidden">
            <div className="flex items-center gap-3">
              <Link
                href="/clients"
                className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
              >
                <Icon i="chevron-left" size={20} className="text-primary-foreground" />
              </Link>
              <div>
                <div className="font-headings font-bold text-lg text-primary-foreground">
                  Fiche client
                </div>
                <div className="text-xs text-secondary">Historique complet des dettes</div>
              </div>
            </div>
          </div>

          {/* Desktop top bar (lg+) */}
          <div className="hidden lg:flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
            <div className="flex items-center gap-3">
              <Link
                href="/clients"
                className="w-9 h-9 rounded-lg bg-input border border-border flex items-center justify-center"
              >
                <Icon i="chevron-left" size={20} className="text-foreground" />
              </Link>
              <div>
                <div className="font-headings font-bold text-2xl text-foreground">Fiche client</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Historique complet des dettes
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell count={notifData?.count} />
              {client && client.phone && client.balanceFcfa > 0 && (
                <a
                  href="#reminder-card"
                  className="flex items-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-sm px-4 py-2 rounded-lg"
                >
                  <Icon i="message-circle" size={16} />
                  Envoyer WhatsApp
                </a>
              )}
              {client && (
                <Link
                  href={`/debts/new?clientId=${client.id}`}
                  className="flex items-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-sm px-4 py-2 rounded-lg"
                >
                  <Icon i="plus" size={16} />
                  Ajouter dette
                </Link>
              )}
            </div>
          </div>

          {loading ? (
            <div className="px-4 lg:px-8 py-8 text-sm text-muted-foreground">Chargement…</div>
          ) : error || !client ? (
            <div className="px-4 lg:px-8 py-8 flex flex-col items-center gap-3 text-center">
              <div className="text-sm text-muted-foreground">Client introuvable.</div>
              <Link href="/clients" className="text-sm text-primary font-bold">
                Retour à la liste
              </Link>
            </div>
          ) : (
            <ClientFicheContent
              client={client}
              isPremium={isPremium}
              autoReminderEnabled={autoReminderSettings?.enabled ?? false}
              shopName={user.shopName}
              onRefresh={refreshAll}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}

interface FicheDerived {
  debtStatuses: Map<string, DebtStatus>;
  debtCount: number;
  overdueCount: number;
  totalPaidFcfa: number;
  overdueBalanceFcfa: number;
  nextEligibleReminderDate: Date | null;
  history: ClientTransaction[];
  paymentProgress: PaymentProgress | null;
}

function deriveFicheData(client: ClientDetail): FicheDerived {
  const debts: DebtTransaction[] = client.transactions
    .filter((t): t is ClientTransaction & { type: 'DEBT' } => t.type === 'DEBT')
    .map((t) => ({
      id: t.id,
      type: 'DEBT',
      amountFcfa: t.amountFcfa,
      createdAt: new Date(t.createdAt),
    }));
  const debtStatuses = computeDebtStatuses(debts);
  const debtCount = debts.length;
  const overdueCount = [...debtStatuses.values()].filter((s) => s === 'OVERDUE').length;
  const totalPaidFcfa = client.transactions
    .filter((t) => t.type === 'PAYMENT')
    .reduce((sum, t) => sum + t.amountFcfa, 0);

  const aging = client.transactions.map((t) => ({
    type: t.type,
    amountFcfa: t.amountFcfa,
    createdAt: new Date(t.createdAt),
  }));
  const overdueBalanceFcfa = computeOverdueBalance(aging);
  const oldest = oldestUnpaidDebtDate(aging);
  const nextEligibleReminderDate = oldest
    ? new Date(oldest.getTime() + AUTO_REMINDER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
    : null;

  const history = [...client.transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const paymentProgress = computePaymentProgress(
    client.transactions.map((t) => ({ ...t, createdAt: new Date(t.createdAt) })),
  );

  return {
    debtStatuses,
    debtCount,
    overdueCount,
    totalPaidFcfa,
    overdueBalanceFcfa,
    nextEligibleReminderDate,
    history,
    paymentProgress,
  };
}

function ClientFicheContent({
  client,
  isPremium,
  autoReminderEnabled,
  shopName,
  onRefresh,
}: {
  client: ClientDetail;
  isPremium: boolean;
  autoReminderEnabled: boolean;
  shopName: string | null;
  onRefresh: () => void;
}) {
  const derived = useMemo(() => deriveFicheData(client), [client]);
  const nextEligibleDate =
    isPremium && autoReminderEnabled ? derived.nextEligibleReminderDate : null;

  return (
    <>
      <div className="lg:hidden">
        <MobileFicheBody
          client={client}
          isPremium={isPremium}
          shopName={shopName}
          derived={derived}
          nextEligibleDate={nextEligibleDate}
          onRefresh={onRefresh}
        />
      </div>
      <div className="hidden lg:block flex-1">
        <DesktopFicheBody
          client={client}
          isPremium={isPremium}
          shopName={shopName}
          derived={derived}
          nextEligibleDate={nextEligibleDate}
          onRefresh={onRefresh}
        />
      </div>
    </>
  );
}

function MobileFicheBody({
  client,
  isPremium,
  shopName,
  derived,
  nextEligibleDate,
  onRefresh,
}: {
  client: ClientDetail;
  isPremium: boolean;
  shopName: string | null;
  derived: FicheDerived;
  nextEligibleDate: Date | null;
  onRefresh: () => void;
}) {
  const { debtStatuses, debtCount, overdueCount, totalPaidFcfa, history } = derived;

  return (
    <div className="px-4 pt-5 pb-8 flex flex-col gap-5 max-w-lg w-full mx-auto">
      <div className="bg-background border border-border rounded-xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
            <span className="font-headings font-bold text-xl text-secondary-foreground">
              {client.firstName.charAt(0)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-headings font-bold text-lg text-foreground truncate">
              {client.firstName}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Client depuis {formatDateFr(client.createdAt)}
            </div>
          </div>
          <Link
            href={`/clients/${client.id}/edit`}
            className="w-8 h-8 rounded-lg bg-input border border-border flex items-center justify-center flex-shrink-0"
          >
            <Icon i="pencil" size={14} className="text-foreground" />
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {client.phone && (
            <div className="flex items-center gap-3">
              <Icon i="phone" size={16} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground">{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-3">
              <Icon i="map-pin" size={16} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground">{client.address}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Total dû"
          value={formatPrice(client.balanceFcfa)}
          danger={client.isOverdue}
        />
        <StatTile label="Total payé" value={formatPrice(totalPaidFcfa)} />
        <StatTile label="Nb dettes" value={String(debtCount)} sub="au total" />
        <StatTile
          label="En retard"
          value={String(overdueCount)}
          sub="à régler"
          danger={overdueCount > 0}
        />
      </div>

      {client.phone && client.balanceFcfa > 0 && (
        <ReminderCard
          client={client}
          isPremium={isPremium}
          nextEligibleDate={nextEligibleDate}
          onReminderSent={onRefresh}
        />
      )}

      {derived.overdueBalanceFcfa > 0 && (
        <MarkOverdueAsPaidButton
          clientId={client.id}
          overdueBalanceFcfa={derived.overdueBalanceFcfa}
          onDone={onRefresh}
        />
      )}

      <PaymentTrackingCard
        progress={derived.paymentProgress}
        clientId={client.id}
        onRefresh={onRefresh}
      />

      <div className="flex flex-col gap-2">
        <div className="font-headings font-bold text-sm text-foreground uppercase tracking-wide">
          Historique
        </div>
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          {history.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Aucune dette enregistrée pour ce client.
            </div>
          ) : (
            history.map((t, i) => (
              <DebtHistoryRow
                key={t.id}
                note={t.note ?? (t.type === 'DEBT' ? 'Dette' : 'Paiement reçu')}
                amount={formatPrice(t.amountFcfa)}
                dateLabel={formatDateFr(t.createdAt)}
                status={t.type === 'PAYMENT' ? 'PAYMENT' : (debtStatuses.get(t.id) ?? 'UNPAID')}
                isFirst={i === 0}
              />
            ))
          )}
        </div>
      </div>

      <ExportPdfButton client={client} isPremium={isPremium} shopName={shopName} />

      <Link
        href={`/debts/new?clientId=${client.id}`}
        className="flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl"
      >
        <Icon i="plus" size={20} />
        Ajouter une dette
      </Link>
    </div>
  );
}

type DesktopFilter = 'all' | 'overdue' | 'paid';

function DesktopFicheBody({
  client,
  isPremium,
  shopName,
  derived,
  nextEligibleDate,
  onRefresh,
}: {
  client: ClientDetail;
  isPremium: boolean;
  shopName: string | null;
  derived: FicheDerived;
  nextEligibleDate: Date | null;
  onRefresh: () => void;
}) {
  const { debtStatuses, debtCount, overdueCount, totalPaidFcfa, history } = derived;
  const [filter, setFilter] = useState<DesktopFilter>('all');

  const filteredHistory = history.filter((t) => {
    if (filter === 'all') return true;
    if (t.type === 'PAYMENT') return false;
    const status = debtStatuses.get(t.id);
    return filter === 'overdue' ? status === 'OVERDUE' : status === 'PAID';
  });

  return (
    <div className="flex gap-8 px-8 pt-8 pb-8">
      {/* Left: identity + stats + reminder */}
      <div className="flex flex-col gap-5 w-[320px] flex-shrink-0">
        <div className="bg-background border border-border rounded-xl p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
              <span className="font-headings font-bold text-2xl text-secondary-foreground">
                {client.firstName.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="font-headings font-bold text-xl text-foreground truncate">
                {client.firstName}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Client depuis {formatDateFr(client.createdAt)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {client.phone && (
              <div className="flex items-center gap-3">
                <Icon i="phone" size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-3">
                <Icon i="map-pin" size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">{client.address}</span>
              </div>
            )}
            {history.length > 0 && (
              <div className="flex items-center gap-3">
                <Icon i="calendar" size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">
                  Dernière activité {formatDateFr(history[0]!.createdAt)}
                </span>
              </div>
            )}
          </div>

          <Link
            href={`/clients/${client.id}/edit`}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-input border border-border text-foreground font-headings font-bold text-xs py-2.5 rounded-lg"
          >
            <Icon i="pencil" size={14} />
            Modifier
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Total dû"
            value={<AnimatedNumber value={client.balanceFcfa} />}
            danger={client.isOverdue}
          />
          <StatTile label="Total payé" value={<AnimatedNumber value={totalPaidFcfa} />} />
          <StatTile
            label="Nb dettes"
            value={<AnimatedNumber value={debtCount} format={(n) => String(n)} />}
            sub="au total"
          />
          <StatTile
            label="En retard"
            value={<AnimatedNumber value={overdueCount} format={(n) => String(n)} />}
            sub="à régler"
            danger={overdueCount > 0}
          />
        </div>

        {client.phone && client.balanceFcfa > 0 && (
          <div id="reminder-card">
            <ReminderCard
              client={client}
              isPremium={isPremium}
              nextEligibleDate={nextEligibleDate}
              onReminderSent={onRefresh}
            />
          </div>
        )}
      </div>

      {/* Right: payment tracking + debt history table */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <PaymentTrackingCard
          progress={derived.paymentProgress}
          clientId={client.id}
          onRefresh={onRefresh}
        />

        <div className="flex items-center justify-between">
          <div className="font-headings font-bold text-base text-foreground">
            Historique des dettes
          </div>
          <div className="flex gap-2">
            {(
              [
                ['all', 'Toutes'],
                ['overdue', 'En retard'],
                ['paid', 'Payées'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                  filter === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-input border border-border text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="grid bg-muted border-b border-border px-6 py-3 grid-cols-[140px_1fr_130px_110px]">
            <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide">
              Date
            </div>
            <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide">
              Articles
            </div>
            <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide text-right">
              Montant
            </div>
            <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide text-center">
              Statut
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              Aucune dette dans cette catégorie.
            </div>
          ) : (
            filteredHistory.map((t, i) => {
              const status =
                t.type === 'PAYMENT' ? 'PAYMENT' : (debtStatuses.get(t.id) ?? 'UNPAID');
              return (
                <div
                  key={t.id}
                  className={`grid items-center px-6 py-4 grid-cols-[140px_1fr_130px_110px] ${
                    i !== 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div className="text-sm text-muted-foreground">{formatDateFr(t.createdAt)}</div>
                  <div className="text-sm text-foreground pr-4 truncate">
                    {t.note ?? (t.type === 'DEBT' ? 'Dette' : 'Paiement reçu')}
                  </div>
                  <div
                    className={`font-headings font-bold text-sm text-right ${
                      status === 'OVERDUE' ? 'text-danger' : 'text-foreground'
                    }`}
                  >
                    {status === 'PAYMENT' ? '−' : ''}
                    {formatPrice(t.amountFcfa)}{' '}
                    <span className="font-body font-normal text-xs text-muted-foreground">
                      FCFA
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <StatusBadge status={status} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-3 mt-2">
          {derived.overdueBalanceFcfa > 0 && (
            <MarkOverdueAsPaidButton
              clientId={client.id}
              overdueBalanceFcfa={derived.overdueBalanceFcfa}
              onDone={onRefresh}
            />
          )}
          <ExportPdfButton client={client} isPremium={isPremium} shopName={shopName} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DebtStatus | 'PAYMENT' }) {
  if (status === 'OVERDUE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-danger font-bold text-xs">
        <Icon i="alert-circle" size={11} />
        En retard
      </span>
    );
  }
  if (status === 'PAID' || status === 'PAYMENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 font-bold text-xs">
        <Icon i="check-circle" size={11} />
        {status === 'PAYMENT' ? 'Paiement' : 'Payée'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-input text-muted-foreground font-bold text-xs">
      <Icon i="clock" size={11} />
      En cours
    </span>
  );
}

const REMINDER_ERROR_MESSAGES: Record<string, string> = {
  PREMIUM_REQUIRED: 'Passe à Premium pour envoyer des rappels WhatsApp.',
  CLIENT_NO_PHONE: 'Ce client n’a pas de numéro de téléphone enregistré.',
  NOTHING_OWED: 'Ce client n’a plus de solde à régler.',
};

// Includes the year: the eligible date is derived from the oldest unpaid
// debt + 7 days, which can land in the past by an arbitrary margin (an old
// unpaid debt) — day+month alone would misread across a year boundary.
const nextEligibleFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function ReminderCard({
  client,
  isPremium,
  nextEligibleDate,
  onReminderSent,
}: {
  client: ClientDetail;
  isPremium: boolean;
  nextEligibleDate: Date | null;
  onReminderSent: () => void;
}) {
  const { pending: sending, error, run } = useAsyncAction();

  if (!isPremium) {
    return (
      <Link
        href="/premium"
        className="bg-secondary border border-border rounded-xl px-4 py-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon i="message-circle" size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground truncate">
            Rappel WhatsApp — réservé à Premium
          </span>
        </div>
        <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-2.5 py-1 rounded-lg flex-shrink-0">
          Premium
        </span>
      </Link>
    );
  }

  async function sendReminder() {
    await run(
      async () => {
        const res = await api<{ url: string }>(`/api/clients/${client.id}/remind`, {
          method: 'POST',
        });
        window.open(res.url, '_blank', 'noopener,noreferrer');
        onReminderSent();
      },
      (err) =>
        err instanceof ApiError
          ? (REMINDER_ERROR_MESSAGES[err.code] ?? err.message)
          : 'Erreur réseau. Réessaie.',
    );
  }

  return (
    <div className="bg-secondary border border-border rounded-xl px-4 py-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon i="clock" size={16} className="text-primary" />
        <span className="font-headings font-bold text-sm text-foreground">Rappel manuel</span>
      </div>
      <div className="text-sm text-muted-foreground">
        {client.lastReminderSentAt
          ? `Dernier rappel envoyé le ${formatDateFr(client.lastReminderSentAt)}`
          : 'Aucun rappel envoyé pour l’instant'}
      </div>
      {nextEligibleDate && (
        <div className="text-xs text-muted-foreground mt-1">
          Rappel automatique éligible à partir du {nextEligibleFormatter.format(nextEligibleDate)}
        </div>
      )}
      {error && <div className="text-sm text-danger mt-2">{error}</div>}
      <button
        type="button"
        onClick={sendReminder}
        disabled={sending}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-headings font-bold text-xs py-2.5 rounded-lg disabled:opacity-60"
      >
        <Icon i="message-circle" size={14} />
        {sending ? 'Ouverture…' : 'Envoyer WhatsApp'}
      </button>
    </div>
  );
}

// "Suivi des paiements" (Phase 9, FicheClient.jsx re-fetch 2026-08-26) —
// whole-client running total (all debts ever recorded vs. current
// outstanding balance), see computePaymentProgress. Not Premium-gated:
// paying down debts is core functionality, same tier as the existing
// "Total dû"/"Total payé" tiles.
function PaymentTrackingCard({
  progress,
  clientId,
  onRefresh,
}: {
  progress: PaymentProgress | null;
  clientId: string;
  onRefresh: () => void;
}) {
  const [amount, setAmount] = useState<number | null>(null);
  const { pending: submitting, error, run } = useAsyncAction();

  if (!progress) return null;

  const percent = Math.round(
    ((progress.originalAmountFcfa - progress.remainingFcfa) / progress.originalAmountFcfa) * 100,
  );

  async function addPayment() {
    if (!amount || amount <= 0) return;
    await run(async () => {
      await api('/api/transactions', {
        method: 'POST',
        body: { clientId, type: 'PAYMENT', amountFcfa: amount },
      });
      setAmount(null);
      onRefresh();
    });
  }

  return (
    <div className="bg-background border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon i="credit-card" size={16} className="text-primary" />
          <span className="font-headings font-bold text-base text-foreground">
            Suivi des paiements
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-3 mb-4">
        <div className="bg-input rounded-lg px-3 py-3">
          <div className="text-xs text-muted-foreground mb-1">Montant initial</div>
          <div className="font-headings font-bold text-base text-foreground">
            {formatPrice(progress.originalAmountFcfa)} FCFA
          </div>
        </div>
        <div className="bg-input rounded-lg px-3 py-3">
          <div className="text-xs text-muted-foreground mb-1">Total versé</div>
          <div className="font-headings font-bold text-base text-primary">
            {formatPrice(progress.originalAmountFcfa - progress.remainingFcfa)} FCFA
          </div>
        </div>
        <div className="rounded-lg px-3 py-3 bg-red-50">
          <div className="text-xs text-muted-foreground mb-1">Reste à payer</div>
          <div className="font-headings font-bold text-base text-danger">
            {formatPrice(progress.remainingFcfa)} FCFA
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${percent}%` }} />
        </div>
        <div className="text-xs text-muted-foreground mt-1.5 text-center">{percent}% remboursé</div>
      </div>

      <div className="border-t border-border pt-3 mt-3">
        <div className="text-xs font-headings font-bold text-muted-foreground mb-3">
          Historique des versements
        </div>
        {progress.events.length === 0 ? (
          <div className="text-xs text-muted-foreground mb-4">
            Aucun versement pour l&rsquo;instant.
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {[...progress.events].reverse().map((e) => (
              <div
                key={e.paymentId}
                className="flex flex-wrap items-center justify-between gap-y-1 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon i="arrow-down" size={12} className="text-primary flex-shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {formatDateFr(e.createdAt.toISOString())}
                  </span>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-headings font-bold text-foreground truncate">
                    {formatPrice(e.amountAppliedFcfa)} FCFA
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    → {formatPrice(e.remainingAfterFcfa)} FCFA restant
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-3">
          <div className="text-xs font-headings font-bold text-muted-foreground mb-2">
            Ajouter un versement
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2">
              <Icon i="credit-card" size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                inputMode="numeric"
                value={amount === null ? '' : String(amount)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setAmount(digits === '' ? null : Number(digits));
                }}
                placeholder="Montant"
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none min-w-0"
              />
            </div>
            <button
              type="button"
              onClick={addPayment}
              disabled={submitting || !amount || amount <= 0}
              className="flex items-center gap-1 bg-primary text-primary-foreground font-headings font-bold text-xs px-3 py-2 rounded-lg disabled:opacity-50"
            >
              <Icon i="plus" size={14} />
              {submitting ? '…' : 'Ajouter'}
            </button>
          </div>
          {error && <div className="text-xs text-danger mt-2">{error}</div>}
        </div>
      </div>
    </div>
  );
}

function MarkOverdueAsPaidButton({
  clientId,
  overdueBalanceFcfa,
  onDone,
}: {
  clientId: string;
  overdueBalanceFcfa: number;
  onDone: () => void;
}) {
  const { pending: submitting, error, run } = useAsyncAction();

  async function markPaid() {
    await run(async () => {
      await api('/api/transactions', {
        method: 'POST',
        body: {
          clientId,
          type: 'PAYMENT',
          amountFcfa: overdueBalanceFcfa,
          note: 'Dettes en retard réglées',
          markOverdueOnly: true,
        },
      });
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={markPaid}
        disabled={submitting}
        className="flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-sm px-5 py-3 rounded-xl disabled:opacity-60"
      >
        <Icon i="check" size={16} />
        {submitting
          ? 'Enregistrement…'
          : `Marquer les dettes en retard comme payées (${formatPrice(overdueBalanceFcfa)} FCFA)`}
      </button>
      {error && <div className="text-xs text-danger">{error}</div>}
    </div>
  );
}

function ExportPdfButton({
  client,
  isPremium,
  shopName,
}: {
  client: ClientDetail;
  isPremium: boolean;
  shopName: string | null;
}) {
  if (!isPremium) {
    return (
      <Link
        href="/premium"
        className="flex items-center justify-center gap-2 bg-background border border-border text-muted-foreground font-headings font-bold text-sm py-3.5 rounded-xl"
      >
        <Icon i="download" size={18} />
        Exporter PDF — réservé à Premium
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => downloadClientHistoryPdf(client, shopName)}
      className="flex items-center justify-center gap-2 bg-background border border-border text-foreground font-headings font-bold text-sm py-3.5 rounded-xl"
    >
      <Icon i="download" size={18} />
      Exporter PDF
    </button>
  );
}

function StatTile({
  label,
  value,
  sub,
  danger = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-background border border-border rounded-xl px-4 py-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div
        className={`font-headings font-bold text-xl ${danger ? 'text-danger' : 'text-foreground'}`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub ?? 'FCFA'}</div>
    </div>
  );
}
