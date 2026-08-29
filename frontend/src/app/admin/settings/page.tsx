'use client';

// Paramètres — no Banani mockup (only the dashboard was designed).
// Read-only visibility over two already-shipped admin endpoints
// (GET /api/admin/audit-log, GET /api/admin/rate-limits) — "who did what"
// and live rate-limit bucket health. Pure UI, no new backend.
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { PageTransition } from '@/components/jurali/PageTransition';
import { Icon } from '@/components/jurali/Icon';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { formatDateFr } from '@/lib/jurali-format';

interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

interface Top10Entry {
  key: string;
  hits: number;
  expiresAt: string | null;
}

interface BucketSummary {
  bucket: string;
  totalKeys: number;
  top10: Top10Entry[];
  truncated?: boolean;
}

type Tab = 'audit' | 'limits';

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('audit');

  return (
    <PageTransition>
      <AdminPageHeader title="Paramètres" subtitle="Journal d'audit et limites de débit" />

      <div className="px-4 lg:px-8 py-6 lg:py-7 flex flex-col gap-5">
        <div className="flex gap-2">
          <TabButton
            active={tab === 'audit'}
            onClick={() => setTab('audit')}
            label="Journal d'audit"
          />
          <TabButton
            active={tab === 'limits'}
            onClick={() => setTab('limits')}
            label="Limites de débit"
          />
        </div>

        {tab === 'audit' ? <AuditLogTab /> : <RateLimitsTab />}
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

function AuditLogTab() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api<{ items: AuditRow[] }>('/api/admin/audit-log?limit=30')
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
  }, [toast]);

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <div className="divide-y divide-border">
        {items.map((row) => (
          <div key={row.id} className="flex flex-col gap-1 px-5 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-headings font-bold text-sm text-foreground">{row.action}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDateFr(row.createdAt)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Acteur : {row.actorId}
              {row.targetType &&
                ` · Cible : ${row.targetType}${row.targetId ? ` (${row.targetId})` : ''}`}
            </div>
            {row.metadata != null && (
              <div className="text-xs text-muted-foreground font-mono truncate">
                {JSON.stringify(row.metadata)}
              </div>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="px-5 py-8 text-sm text-muted-foreground text-center">
            Aucune action administrative enregistrée.
          </div>
        )}
      </div>
    </div>
  );
}

function RateLimitsTab() {
  const [buckets, setBuckets] = useState<BucketSummary[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    api<{ buckets: BucketSummary[]; note?: string }>('/api/admin/rate-limits')
      .then((res) => {
        if (!cancelled) {
          setBuckets(res.buckets);
          setNote(res.note ?? null);
        }
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
  }, [toast]);

  if (!loading && note) {
    return (
      <div className="bg-background border border-border rounded-xl p-6 flex items-center gap-3">
        <Icon i="alert-circle" size={18} className="text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground">Redis non configuré — {note}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {buckets.map((b) => (
        <div key={b.bucket} className="bg-background border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-headings font-bold text-sm text-foreground">{b.bucket}</span>
            <span className="text-xs text-muted-foreground">
              {b.totalKeys} clé{b.totalKeys > 1 ? 's' : ''}
              {b.truncated ? ' (tronqué)' : ''}
            </span>
          </div>
          {b.top10.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {b.top10.slice(0, 5).map((entry) => (
                <div key={entry.key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{entry.key}</span>
                  <span className="font-headings font-bold text-foreground flex-shrink-0">
                    {entry.hits}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Aucune clé active.</div>
          )}
        </div>
      ))}
    </div>
  );
}
