'use client';

// Dettes en retard — Banani's DettesEnRetardDesktop.jsx (2026-08-26). One
// row PER OVERDUE DEBT (not per client), unlike the existing /clients?
// filter=overdue chip which stays a client-level quick filter on the
// dashboard/debtor list — this is a distinct, richer screen reachable from
// DesktopSidebar's "En retard" nav item. See .planning/banani/
// dettes-en-retard.md for the confirmed decisions (no bulk WhatsApp send —
// wa.me only supports one conversation at a time — real bulk mark-paid,
// reuses the existing CSV export).
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { NotificationBell } from '@/components/jurali/TopBar';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { useExportDebtsCsv } from '@/lib/useExportDebtsCsv';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
}

interface SubscriptionData {
  isActive: boolean;
}

interface OverdueRow {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  amountFcfa: number;
  note: string | null;
  createdAt: string;
  daysOverdue: number;
}

interface OverdueData {
  totalOverdueFcfa: number;
  averageDaysOverdue: number;
  affectedClientCount: number;
  totalClientCount: number;
  items: OverdueRow[];
}

export default function OverdueDebtsPage() {
  const user = useUser();
  const { toast } = useToast();
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });
  const {
    data: overdue,
    loading,
    refresh,
  } = useApi<OverdueData>('/api/debts/overdue', { skip: !user });
  const isPremium = subscription?.isActive ?? false;
  const [markingPaid, setMarkingPaid] = useState(false);

  if (!user) return null;

  const items = overdue?.items ?? [];
  const perClientTotal = new Map<string, number>();
  for (const item of items) {
    perClientTotal.set(item.clientId, (perClientTotal.get(item.clientId) ?? 0) + item.amountFcfa);
  }

  async function markAllPaid() {
    setMarkingPaid(true);
    try {
      const results = await Promise.allSettled(
        [...perClientTotal.entries()].map(([clientId, amountFcfa]) =>
          api('/api/transactions', {
            method: 'POST',
            body: { clientId, type: 'PAYMENT', amountFcfa, note: 'Dettes en retard réglées' },
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        toast(
          `${failed} paiement${failed > 1 ? 's' : ''} sur ${results.length} n'ont pas pu être enregistrés.`,
          'error',
        );
      } else {
        toast('Dettes en retard réglées.', 'success');
      }
      await refresh();
    } finally {
      setMarkingPaid(false);
    }
  }

  const displayName = user.shopName || user.email;
  const sharedProps = { items, isPremium, markingPaid, onMarkAllPaid: markAllPaid };

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col lg:flex-row">
      <DesktopSidebar
        displayName={displayName}
        fullName={user.name}
        totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
        debtorCount={dashboard?.debtorCount ?? 0}
        overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
        overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
        loading={dashboardLoading}
      />

      {/* Mobile/tablet (< lg) */}
      <div className="flex-1 flex flex-col lg:hidden">
        <div className="bg-primary px-4 pt-10 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
            >
              <Icon i="chevron-left" size={20} className="text-primary-foreground" />
            </Link>
            <div>
              <div className="font-headings font-bold text-lg text-primary-foreground">
                Dettes en retard
              </div>
              <div className="text-xs text-secondary">
                {overdue
                  ? `${overdue.affectedClientCount} client${overdue.affectedClientCount === 1 ? '' : 's'} avec paiements en retard`
                  : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pt-5 pb-8 flex flex-col gap-4 max-w-lg w-full mx-auto">
          {loading || !overdue ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <>
              <SummaryStats overdue={overdue} />
              <OverdueList {...sharedProps} />
              <BottomActions {...sharedProps} />
            </>
          )}
        </div>
      </div>

      {/* Desktop (lg+) */}
      <div className="hidden lg:flex flex-1 flex-col">
        <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
          <div>
            <div className="font-headings font-bold text-2xl text-foreground">Dettes en retard</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {overdue
                ? `${overdue.affectedClientCount} client${overdue.affectedClientCount === 1 ? '' : 's'} avec paiements en retard`
                : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton isPremium={isPremium} />
            <NotificationBell count={notifData?.count} />
          </div>
        </div>

        <div className="flex-1 px-8 pt-8 pb-8 flex flex-col">
          {loading || !overdue ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-6 mb-8">
                <StatCardBlock
                  label="Total en retard"
                  value={formatPrice(overdue.totalOverdueFcfa)}
                  unit="FCFA"
                  sub={`${overdue.items.length} dette${overdue.items.length === 1 ? '' : 's'} urgente${overdue.items.length === 1 ? '' : 's'}`}
                  icon="alert-circle"
                  tone="danger"
                />
                <StatCardBlock
                  label="Jours en retard (moy)"
                  value={String(overdue.averageDaysOverdue)}
                  unit="jours"
                  sub="Ancienneté moyenne des dettes en retard"
                  icon="clock"
                />
                <StatCardBlock
                  label="Clients affectés"
                  value={String(overdue.affectedClientCount)}
                  unit={`sur ${overdue.totalClientCount}`}
                  sub={
                    overdue.totalClientCount > 0
                      ? `${Math.round((overdue.affectedClientCount / overdue.totalClientCount) * 1000) / 10}% des clients`
                      : '—'
                  }
                  icon="users"
                  tone="primary"
                />
              </div>

              <OverdueTable {...sharedProps} />

              <div className="flex gap-3 mt-6">
                <MarkAllPaidButton {...sharedProps} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStats({ overdue }: { overdue: OverdueData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        label="Total en retard"
        value={formatPrice(overdue.totalOverdueFcfa)}
        sub="FCFA"
        danger
      />
      <StatTile label="Jours (moy)" value={String(overdue.averageDaysOverdue)} sub="jours" />
      <StatTile
        label="Clients affectés"
        value={String(overdue.affectedClientCount)}
        sub={`sur ${overdue.totalClientCount}`}
      />
      <StatTile
        label="Dettes urgentes"
        value={String(overdue.items.length)}
        sub="au total"
        danger
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  danger = false,
}: {
  label: string;
  value: string;
  sub: string;
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
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function StatCardBlock({
  label,
  value,
  unit,
  sub,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  icon: string;
  tone?: 'default' | 'danger' | 'primary';
}) {
  const valueClass =
    tone === 'danger' ? 'text-danger' : tone === 'primary' ? 'text-primary' : 'text-foreground';
  const boxClass =
    tone === 'danger' ? 'bg-red-100 text-danger' : 'bg-secondary text-secondary-foreground';
  return (
    <div className="bg-background border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <div className="text-xs font-headings font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className={`font-headings font-bold text-3xl mt-2 ${valueClass}`}>{value}</div>
          <div className="text-sm text-muted-foreground mt-1">{unit}</div>
        </div>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${boxClass}`}
        >
          <Icon i={icon} size={24} />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

interface ListProps {
  items: OverdueRow[];
  isPremium: boolean;
}

function OverdueList({ items }: ListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-background border border-border rounded-xl px-4 py-6 text-sm text-muted-foreground text-center">
        Aucune dette en retard — bravo !
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="bg-background border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <span className="font-headings font-bold text-sm text-secondary-foreground">
                {item.clientName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-headings font-bold text-sm text-foreground truncate">
                {item.clientName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {item.note ?? 'Dette'} · {formatDateFr(item.createdAt)}
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded-lg bg-red-100 text-danger font-bold text-xs flex-shrink-0">
              {item.daysOverdue}j
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="font-headings font-bold text-base text-danger">
              {formatPrice(item.amountFcfa)} <span className="text-xs font-normal">FCFA</span>
            </div>
            <SendReminderButton clientId={item.clientId} clientPhone={item.clientPhone} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OverdueTable({ items }: ListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-background border border-border rounded-xl px-6 py-6 text-sm text-muted-foreground">
        Aucune dette en retard — bravo !
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <div
        className="grid bg-muted border-b border-border px-6 py-4"
        style={{ gridTemplateColumns: '140px 1fr 120px 100px 80px' }}
      >
        <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide">
          Date
        </div>
        <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide">
          Client
        </div>
        <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide text-right">
          Montant
        </div>
        <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide text-center">
          Retard
        </div>
        <div className="text-xs font-headings font-bold text-muted-foreground uppercase tracking-wide text-center">
          Action
        </div>
      </div>

      <div className="divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid items-center px-6 py-4 hover:bg-input"
            style={{ gridTemplateColumns: '140px 1fr 120px 100px 80px' }}
          >
            <div className="text-sm text-muted-foreground">{formatDateFr(item.createdAt)}</div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <span className="font-headings font-bold text-sm text-secondary-foreground">
                  {item.clientName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-headings font-bold text-sm text-foreground truncate">
                  {item.clientName}
                </div>
                <div className="text-xs text-muted-foreground truncate">{item.note ?? 'Dette'}</div>
              </div>
            </div>
            <div className="font-headings font-bold text-sm text-danger text-right">
              {formatPrice(item.amountFcfa)}
            </div>
            <div className="text-center">
              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-red-100 text-danger font-bold text-xs">
                {item.daysOverdue}j
              </span>
            </div>
            <div className="flex justify-center">
              <SendReminderButton clientId={item.clientId} clientPhone={item.clientPhone} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SendReminderButton({
  clientId,
  clientPhone,
  compact = false,
}: {
  clientId: string;
  clientPhone: string | null;
  compact?: boolean;
}) {
  const [sending, setSending] = useState(false);

  if (!clientPhone) return null;

  async function send() {
    setSending(true);
    try {
      const res = await api<{ url: string }>(`/api/clients/${clientId}/remind`, { method: 'POST' });
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch {
      // Premium gate / no-balance / rate errors surface via the fiche page's
      // own reminder card — this compact row action stays a silent no-op on
      // failure rather than duplicating that error UI in a table row.
    } finally {
      setSending(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={send}
        disabled={sending}
        aria-label="Envoyer un rappel WhatsApp"
        className="w-7 h-7 rounded-lg bg-input border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-50"
      >
        <Icon i="message-circle" size={14} className="text-muted-foreground" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className="flex items-center gap-1.5 bg-input border border-border text-foreground font-headings font-bold text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
    >
      <Icon i="message-circle" size={12} />
      {sending ? 'Ouverture…' : 'Envoyer'}
    </button>
  );
}

interface BottomActionsProps {
  items: OverdueRow[];
  isPremium: boolean;
  markingPaid: boolean;
  onMarkAllPaid: () => void;
}

function BottomActions({ items, markingPaid, onMarkAllPaid, isPremium }: BottomActionsProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onMarkAllPaid}
        disabled={markingPaid}
        className="flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-3.5 rounded-xl disabled:opacity-60"
      >
        <Icon i="check" size={18} />
        {markingPaid ? 'Enregistrement…' : 'Marquer les dettes en retard comme payées'}
      </button>
      <ExportButton isPremium={isPremium} full />
    </div>
  );
}

function MarkAllPaidButton({ items, markingPaid, onMarkAllPaid }: BottomActionsProps) {
  if (items.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onMarkAllPaid}
      disabled={markingPaid}
      className="flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base px-6 py-3 rounded-xl disabled:opacity-60"
    >
      <Icon i="check" size={18} />
      {markingPaid ? 'Enregistrement…' : 'Marquer comme payés'}
    </button>
  );
}

function ExportButton({ isPremium, full = false }: { isPremium: boolean; full?: boolean }) {
  const { exporting, error, exportCsv } = useExportDebtsCsv();

  if (!isPremium) {
    return (
      <Link
        href="/premium"
        className={`flex items-center justify-center gap-2 bg-surface border border-border text-muted-foreground font-headings font-bold text-sm px-4 py-2 rounded-lg ${full ? 'w-full py-3.5' : ''}`}
      >
        <Icon i="download" size={16} />
        Exporter — Premium
      </Link>
    );
  }

  return (
    <div className={full ? 'w-full' : ''}>
      <button
        type="button"
        onClick={exportCsv}
        disabled={exporting}
        className={`flex items-center justify-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-sm px-4 py-2 rounded-lg disabled:opacity-50 ${full ? 'w-full py-3.5' : ''}`}
      >
        <Icon i="download" size={16} />
        {exporting ? 'Préparation…' : 'Exporter'}
      </button>
      {error && <div className="text-xs text-danger mt-2">{error}</div>}
    </div>
  );
}
