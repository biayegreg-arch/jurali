'use client';

// Notifications — no Banani mockup (only the dashboard was designed).
// Read-only visibility over two already-shipped admin endpoints
// (GET /api/admin/email-queue, GET /api/admin/outbox) — this page is
// pure UI, no new backend.
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { PageTransition } from '@/components/jurali/PageTransition';
import { Skeleton } from '@/components/jurali/Skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatusPill, type AdminStatusTone } from '@/components/admin/AdminStatusPill';
import { formatDateFr } from '@/lib/jurali-format';

type JobStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';

const STATUS_TONE: Record<JobStatus, AdminStatusTone> = {
  PENDING: 'warning',
  SENT: 'positive',
  FAILED: 'danger',
  DEAD: 'neutral',
};

interface EmailJobRow {
  id: string;
  to: string;
  subject: string;
  bodyPreview: string;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

interface OutboxRow {
  id: string;
  kind: string;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

type Tab = 'email' | 'outbox';

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>('email');

  return (
    <PageTransition>
      <AdminPageHeader title="Notifications" subtitle="File d'emails et événements outbox" />

      <div className="px-4 lg:px-8 py-6 lg:py-7 flex flex-col gap-5">
        <div className="flex gap-2">
          <TabButton
            active={tab === 'email'}
            onClick={() => setTab('email')}
            label="File d'emails"
          />
          <TabButton active={tab === 'outbox'} onClick={() => setTab('outbox')} label="Outbox" />
        </div>

        {tab === 'email' ? <EmailQueueTab /> : <OutboxTab />}
      </div>
    </PageTransition>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-headings font-bold text-sm px-4 py-2 rounded-lg ${
        active ? 'bg-primary text-primary-foreground' : 'bg-input text-muted-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: JobStatus | '';
  onChange: (v: JobStatus | '') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as JobStatus | '')}
      className="text-sm bg-input border border-border rounded-lg px-3 py-2 text-foreground"
    >
      <option value="">Tous les statuts</option>
      <option value="PENDING">En attente</option>
      <option value="SENT">Envoyé</option>
      <option value="FAILED">Échoué</option>
      <option value="DEAD">Abandonné</option>
    </select>
  );
}

function EmailQueueTab() {
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [items, setItems] = useState<EmailJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', '30');
    api<{ items: EmailJobRow[] }>(`/api/admin/email-queue?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) toast(err instanceof ApiError ? err.message : 'Erreur réseau.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, toast]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <StatusFilter value={status} onChange={setStatus} />
      </div>
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {loading && items.length === 0
            ? Array.from({ length: 6 }, (_, i) => <JobRowSkeleton key={i} />)
            : items.map((job) => (
                <div key={job.id} className="flex flex-col gap-1.5 px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-headings font-bold text-sm text-foreground truncate">
                      {job.subject}
                    </div>
                    <AdminStatusPill label={job.status} tone={STATUS_TONE[job.status]} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{job.to}</div>
                  {job.lastError && (
                    <div className="text-xs text-danger truncate">{job.lastError}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{formatDateFr(job.createdAt)}</div>
                </div>
              ))}
          {!loading && items.length === 0 && (
            <div className="px-5 py-8 text-sm text-muted-foreground text-center">
              Aucun email ne correspond.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OutboxTab() {
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [items, setItems] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', '30');
    api<{ items: OutboxRow[] }>(`/api/admin/outbox?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) toast(err instanceof ApiError ? err.message : 'Erreur réseau.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, toast]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <StatusFilter value={status} onChange={setStatus} />
      </div>
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {loading && items.length === 0
            ? Array.from({ length: 6 }, (_, i) => <JobRowSkeleton key={i} />)
            : items.map((e) => (
                <div key={e.id} className="flex flex-col gap-1.5 px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-headings font-bold text-sm text-foreground truncate">
                      {e.kind}
                    </div>
                    <AdminStatusPill label={e.status} tone={STATUS_TONE[e.status]} />
                  </div>
                  {e.lastError && <div className="text-xs text-danger truncate">{e.lastError}</div>}
                  <div className="text-xs text-muted-foreground">
                    {formatDateFr(e.createdAt)} · {e.attempts} tentative{e.attempts > 1 ? 's' : ''}
                  </div>
                </div>
              ))}
          {!loading && items.length === 0 && (
            <div className="px-5 py-8 text-sm text-muted-foreground text-center">
              Aucun événement ne correspond.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobRowSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-5 w-16 rounded-md flex-shrink-0" />
      </div>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
