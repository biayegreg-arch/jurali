'use client';

// Nouvelle dette — PRD 3.3 / US-01. Mobile reproduces Banani's
// NewDebtForm.jsx + NewDebtForm2.jsx (single screen — see
// .planning/banani/new-debt.md). Desktop (lg+) reproduces `NewDebtDesktop`
// (2026-08-26, reversing the earlier "no sidebar" decision) — sidebar +
// 2-column layout with a Premium "Rappel automatique" shortcut and a
// "Clients récents" panel. The itemized "Articles achetés" list and the
// "+ Créer client" shortcut were desktop-only at first but are genuinely
// useful on mobile too (mobile-first audit, 2026-08-31) — both are now
// shared across breakpoints, with only the right-column-only widgets
// (reminder toggle, Clients récents, Astuce) staying `hidden lg:flex`.
// Both layouts share the SAME ClientPicker/AmountField instances (only the
// surrounding chrome differs via `lg:` classes) so typing/searching never
// fires duplicate `/api/clients` requests from two simultaneously-mounted
// pickers — see .planning/banani/statistics.md for the sibling screen's
// version of this same constraint.
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi, invalidateAllCache } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { NotificationBell } from '@/components/jurali/TopBar';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { PageTransition } from '@/components/jurali/PageTransition';
import { ClientPicker, type PickedClient } from '@/components/jurali/ClientPicker';
import { AmountField } from '@/components/jurali/AmountField';
import { formatPrice } from '@/lib/utils';
import { tapScale } from '@/lib/motion';
import type { ClientSummary } from '@/lib/server/jurali/clients';

export default function NewDebtPage() {
  return (
    <Suspense fallback={null}>
      <NewDebtPageContent />
    </Suspense>
  );
}

interface PresetClientDetail {
  id: string;
  firstName: string;
  balanceFcfa: number;
}

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  totalClientCount: number;
}

interface SubscriptionData {
  isActive: boolean;
}

interface Article {
  name: string;
  amountFcfa: number;
}

const CLIENT_PICKER_INPUT_ID = 'new-debt-client-picker';

function NewDebtPageContent() {
  const user = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const clientIdParam = params.get('clientId');

  const { data: presetClient } = useApi<PresetClientDetail>(
    clientIdParam ? `/api/clients/${clientIdParam}` : '',
    { skip: !clientIdParam },
  );
  // Sidebar KPI tiles + reminder-toggle gating — same "always fetch, CSS
  // hides the sidebar on mobile" pattern as /clients, /dashboard, /stats.
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });

  const [client, setClient] = useState<PickedClient | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presetClient) {
      setClient({
        id: presetClient.id,
        firstName: presetClient.firstName,
        balanceFcfa: presetClient.balanceFcfa,
      });
    }
  }, [presetClient]);

  // Desktop-only "Articles achetés" list sums straight into the same
  // `amount` field used for submission — no parallel total to keep in
  // sync by hand, no new schema (2026-08-26 decision). Once the list has
  // been used at least once, `amount` keeps tracking it even back down to
  // 0 when the last article is removed — otherwise removing every article
  // left `amount` stuck at the old total with no visible articles to
  // justify it (audit fix, 2026-08-26).
  const articlesTotal = articles.reduce((sum, a) => sum + a.amountFcfa, 0);
  const articlesEngagedRef = useRef(false);
  useEffect(() => {
    if (articles.length > 0) articlesEngagedRef.current = true;
    if (articlesEngagedRef.current) setAmount(articlesTotal);
  }, [articles.length, articlesTotal]);

  if (!user) return null;

  async function submit() {
    if (!client || !amount || amount <= 0) return;
    setSubmitting(true);
    setError(null);
    const composedNote = articles.length > 0 ? articles.map((a) => a.name).join(', ') : '';
    try {
      await api('/api/transactions', {
        method: 'POST',
        body: {
          clientId: client.id,
          type: 'DEBT',
          amountFcfa: amount,
          ...(composedNote ? { note: composedNote } : {}),
        },
      });
      invalidateAllCache();
      toast('Dette enregistrée', 'success');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!client && !!amount && amount > 0 && !submitting;
  const displayName = user.shopName || user.email;
  const isPremium = subscription?.isActive ?? false;

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
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/dashboard"
                className="w-10 h-10 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
              >
                <Icon i="chevron-left" size={20} className="text-primary-foreground" />
              </Link>
              <div className="font-headings font-bold text-lg text-primary-foreground">
                Nouvelle dette
              </div>
            </div>
            <div className="text-xs text-secondary font-body ml-11 opacity-90">
              Remplis les infos rapidement
            </div>
          </div>

          {/* Desktop top bar (lg+) */}
          <div className="hidden lg:flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="w-9 h-9 rounded-lg bg-input border border-border flex items-center justify-center"
              >
                <Icon i="chevron-left" size={20} className="text-foreground" />
              </Link>
              <div>
                <div className="font-headings font-bold text-2xl text-foreground">
                  Nouvelle dette
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Enregistre une dette en moins de 5 secondes
                </div>
              </div>
            </div>
            <NotificationBell count={notifData?.count} />
          </div>

          <div className="flex-1 px-4 lg:px-8 pt-5 lg:pt-8 pb-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Form column */}
            <div className="flex-1 flex flex-col max-w-lg lg:max-w-none w-full mx-auto lg:mx-0">
              <Link
                href="/clients/new?next=/debts/new"
                className="lg:hidden flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-headings font-bold text-sm py-3 rounded-xl mb-4"
              >
                <Icon i="plus" size={18} />
                Créer client
              </Link>

              <ClientPicker value={client} onChange={setClient} inputId={CLIENT_PICKER_INPUT_ID} />

              <AmountField label="Montant dû" value={amount} onChange={setAmount} />

              <div className="mb-6">
                <ArticlesList articles={articles} onChange={setArticles} />
              </div>

              {/* Desktop: Premium reminder-toggle shortcut */}
              <div className="hidden lg:block mb-6">
                <ReminderToggle isPremium={isPremium} />
              </div>

              {error && <div className="mb-4 text-sm text-danger">{error}</div>}

              <div className="flex-1 lg:hidden" />

              <div className="flex flex-col lg:flex-row gap-3 pt-0 lg:pt-2">
                <motion.button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  whileTap={tapScale}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl disabled:opacity-50"
                >
                  <Icon i="check" size={20} />
                  {submitting ? 'Enregistrement…' : 'Enregistrer la dette'}
                </motion.button>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-base py-3 lg:py-4 lg:px-6 rounded-xl"
                >
                  <Icon i="x" size={18} />
                  Annuler
                </Link>
              </div>
            </div>

            {/* Right column (lg+) */}
            <div className="hidden lg:flex flex-col gap-5 w-[340px] flex-shrink-0">
              <Link
                href="/clients/new?next=/debts/new"
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-headings font-bold text-base py-3.5 rounded-xl"
              >
                <Icon i="plus" size={20} />
                Créer client
              </Link>

              <RecentClientsPanel onSelect={setClient} />

              <div className="flex items-center gap-2 px-4 py-3 bg-input border border-border rounded-xl">
                <div className="w-3 h-3 rounded-full bg-accent flex-shrink-0" />
                <div>
                  <div className="text-xs font-headings font-bold text-foreground">Statut</div>
                  <div className="text-sm font-body text-muted-foreground">Impayé</div>
                </div>
              </div>

              <div className="bg-secondary border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon i="zap" size={16} className="text-primary" />
                  <span className="font-headings font-bold text-sm text-foreground">Astuce</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tu peux enregistrer une dette en moins de 5 secondes : choisis le client, tape le
                  montant, appuie sur Enregistrer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function ArticlesList({
  articles,
  onChange,
}: {
  articles: Article[];
  onChange: (articles: Article[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const total = articles.reduce((sum, a) => sum + a.amountFcfa, 0);

  function addArticle() {
    if (!name.trim() || !amount || amount <= 0) return;
    onChange([...articles, { name: name.trim(), amountFcfa: amount }]);
    setName('');
    setAmount(null);
    setAdding(false);
  }

  function removeArticle(index: number) {
    onChange(articles.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2">
        Articles achetés
      </div>
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        {articles.length > 0 && (
          <div className="divide-y divide-border">
            {articles.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-body text-foreground">{a.name}</div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-headings font-bold text-foreground">
                    {formatPrice(a.amountFcfa)} FCFA
                  </div>
                  <button
                    type="button"
                    onClick={() => removeArticle(i)}
                    aria-label={`Retirer ${a.name}`}
                  >
                    <Icon i="x" size={14} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de l'article"
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none min-w-0"
            />
            <input
              type="text"
              inputMode="numeric"
              value={amount === null ? '' : String(amount)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setAmount(digits === '' ? null : Number(digits));
              }}
              placeholder="FCFA"
              className="w-20 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none text-right"
            />
            <button type="button" onClick={addArticle} className="text-primary flex-shrink-0">
              <Icon i="check" size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-primary font-body text-sm font-bold border-t border-border"
          >
            <Icon i="plus" size={16} />
            Ajouter un article
          </button>
        )}
      </div>

      {articles.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-4 py-3 bg-secondary border border-border rounded-xl">
          <div className="text-sm font-headings font-bold text-foreground">Total articles</div>
          <div className="text-lg font-headings font-bold text-secondary-foreground">
            {formatPrice(total)} FCFA
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderToggle({ isPremium }: { isPremium: boolean }) {
  const { data, loading } = useApi<{ enabled: boolean }>('/api/settings/auto-reminders', {
    skip: !isPremium,
  });
  const [override, setOverride] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const current = override ?? data?.enabled ?? false;

  async function toggle() {
    if (saving) return;
    const next = !current;
    setOverride(next);
    setSaving(true);
    try {
      await api('/api/settings/auto-reminders', { method: 'PATCH', body: { enabled: next } });
      invalidateAllCache();
    } catch {
      setOverride(!next);
    } finally {
      setSaving(false);
    }
  }

  if (!isPremium) {
    return (
      <Link
        href="/premium"
        className="flex items-center justify-between bg-input border border-border rounded-xl px-4 py-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon i="clock" size={18} className="text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-headings font-bold text-muted-foreground truncate">
              Rappel automatique
            </div>
            <div className="text-xs text-muted-foreground">Réservé à Premium</div>
          </div>
        </div>
        <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-2.5 py-1 rounded-lg flex-shrink-0">
          Premium
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between bg-input border border-border rounded-xl px-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <Icon i="clock" size={18} className="text-primary flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-headings font-bold text-foreground">Rappel automatique</div>
          <div className="text-xs text-muted-foreground">S&rsquo;applique à tous tes clients</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={current}
        disabled={loading || saving}
        onClick={toggle}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 ${
          current ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
            current ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function RecentClientsPanel({ onSelect }: { onSelect: (client: PickedClient) => void }) {
  const { data, loading } = useApi<{ items: ClientSummary[] }>(
    '/api/clients?sort=activity&order=desc&limit=4',
  );
  const items = data?.items ?? [];

  return (
    <div>
      <div className="font-headings font-bold text-base text-foreground mb-3">Clients récents</div>
      <div className="bg-background border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-3.5 text-sm text-muted-foreground">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-3.5 text-sm text-muted-foreground">
            Aucun client pour l&rsquo;instant.
          </div>
        ) : (
          items.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onSelect({ id: c.id, firstName: c.firstName, balanceFcfa: c.balanceFcfa })
              }
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
                i !== 0 ? 'border-t border-border' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                <span className="font-headings font-bold text-sm text-secondary-foreground">
                  {c.firstName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-headings font-bold text-sm text-foreground truncate">
                  {c.firstName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.lastNote ?? 'Aucune note'}
                </div>
              </div>
              <div className="text-sm font-headings font-bold text-muted-foreground flex-shrink-0">
                {formatPrice(c.balanceFcfa)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
