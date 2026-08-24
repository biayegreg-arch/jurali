'use client';

// Jurali Premium — PRD §4/§6, US-06. Reproduces Banani's PagePremium.jsx
// (monthly-only, no annual/trial — Phase 0.3); see
// .planning/banani/page-premium.md for translation notes and decisions.
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';

interface SubscriptionData {
  status: string;
  renewsAt: string | null;
  isActive: boolean;
  planAmountFcfa: number;
}

const FREE_FEATURES = ['Jusqu’à 10 clients', 'Suivi des dettes et paiements', 'Historique complet'];

const PREMIUM_FEATURES: { label: string; icon: string }[] = [
  { label: 'Clients illimités', icon: 'users' },
  { label: 'Rappels WhatsApp automatiques', icon: 'message-circle' },
  { label: 'Statistiques avancées', icon: 'bar-chart-2' },
  { label: 'Historique complet illimité', icon: 'clock' },
  { label: 'Export CSV & PDF', icon: 'download' },
  { label: 'Synchronisation multi-appareils', icon: 'refresh-cw' },
  { label: 'Accès prioritaire au support', icon: 'headphones' },
  { label: 'Sauvegarde automatique cloud', icon: 'cloud' },
];

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_SUBSCRIBED: 'Tu es déjà Premium.',
  PAYMENT_PROVIDER_UNCONFIGURED: 'Le paiement n’est pas encore configuré. Réessaie plus tard.',
  PAYMENT_PROVIDER_UNAVAILABLE:
    'Service de paiement temporairement indisponible. Réessaie dans un instant.',
  PAYMENT_IN_FLIGHT: 'Un paiement est déjà en cours. Réessaie dans quelques secondes.',
  PAYMENT_FAILED: 'Le paiement a échoué. Réessaie.',
};

export default function PremiumPage() {
  const user = useUser();
  const { data: sub, loading } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function subscribe() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ status: string; paymentUrl: string }>('/api/subscriptions', {
        method: 'POST',
      });
      window.location.href = res.paymentUrl;
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ERROR_MESSAGES[err.code] ?? err.message)
          : 'Erreur réseau. Réessaie.',
      );
      setSubmitting(false);
    }
  }

  const isActive = sub?.isActive ?? false;
  const planAmount = sub?.planAmountFcfa ?? 2500;

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col">
      <div className="bg-primary px-4 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
          >
            <Icon i="chevron-left" size={20} className="text-primary-foreground" />
          </Link>
          <div>
            <div className="font-headings font-bold text-lg text-primary-foreground">
              Jurali Premium
            </div>
            <div className="text-xs text-secondary">Gère ta boutique sans limite</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 flex flex-col gap-6 max-w-5xl w-full mx-auto lg:flex-row lg:items-start">
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {isActive ? (
            <div className="bg-primary rounded-2xl px-6 py-6 flex items-center gap-3">
              <Icon i="zap" size={24} className="text-accent flex-shrink-0" />
              <div>
                <div className="font-headings font-bold text-lg text-primary-foreground">
                  Tu es Premium
                </div>
                <div className="text-sm text-secondary mt-0.5">
                  {sub?.renewsAt
                    ? `Renouvellement le ${formatDateFr(sub.renewsAt)}`
                    : 'Abonnement actif'}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-primary rounded-2xl px-6 py-6">
              <div className="flex items-center gap-2 mb-3">
                <Icon i="zap" size={20} className="text-accent" />
                <span className="font-headings font-bold text-base text-primary-foreground uppercase tracking-wide">
                  Premium
                </span>
              </div>
              <div className="font-headings font-bold text-3xl lg:text-4xl text-primary-foreground mb-1">
                {formatPrice(planAmount)}{' '}
                <span className="text-lg lg:text-xl font-body font-normal">FCFA/mois</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-background border border-border rounded-xl px-6 py-6 flex flex-col gap-4">
              <div>
                <div className="font-headings font-bold text-lg text-foreground">Gratuit</div>
                <div className="font-headings font-bold text-3xl text-muted-foreground mt-1">
                  0 <span className="text-base font-body font-normal">FCFA</span>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {FREE_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Icon i="check" size={14} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{f}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Icon i="x" size={14} className="text-muted flex-shrink-0" />
                  <span className="text-sm text-muted">Rappels WhatsApp</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon i="x" size={14} className="text-muted flex-shrink-0" />
                  <span className="text-sm text-muted">Statistiques avancées</span>
                </div>
              </div>
              <div className="mt-auto pt-2">
                <div className="w-full text-center font-headings font-bold text-sm py-3 rounded-xl border border-border text-muted-foreground">
                  {isActive ? 'Inclus dans Premium' : 'Plan actuel'}
                </div>
              </div>
            </div>

            <div className="bg-primary rounded-xl px-6 py-6 flex flex-col gap-4 relative overflow-hidden">
              {!isActive && (
                <div className="absolute top-4 right-4">
                  <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-2.5 py-1 rounded-lg">
                    Recommandé
                  </span>
                </div>
              )}
              <div>
                <div className="font-headings font-bold text-lg text-primary-foreground">
                  Premium
                </div>
                <div className="font-headings font-bold text-3xl text-primary-foreground mt-1">
                  {formatPrice(planAmount)}{' '}
                  <span className="text-base font-body font-normal text-secondary">FCFA/mois</span>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {PREMIUM_FEATURES.slice(0, 6).map((f) => (
                  <div key={f.label} className="flex items-center gap-2">
                    <Icon i="check" size={14} className="text-accent flex-shrink-0" />
                    <span className="text-sm text-primary-foreground">{f.label}</span>
                  </div>
                ))}
              </div>
              {error && <div className="text-sm text-accent">{error}</div>}
              <button
                type="button"
                onClick={subscribe}
                disabled={isActive || submitting}
                className="mt-auto w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-3.5 rounded-xl disabled:opacity-60"
              >
                <Icon i="zap" size={18} />
                {isActive ? 'Plan actuel' : submitting ? 'Redirection…' : 'Passer à Premium'}
              </button>
            </div>
          </div>

          <div className="bg-input border border-border rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon i="smartphone" size={16} className="text-muted-foreground" />
              <span className="text-sm text-foreground font-headings font-bold">
                Paiement mobile
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {['Orange Money', 'Wave', 'Free Money'].map((m) => (
                <span
                  key={m}
                  className="text-xs font-bold text-muted-foreground px-3 py-1.5 border border-border rounded-lg bg-background"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:w-[360px] lg:flex-shrink-0">
          <div>
            <div className="font-headings font-bold text-base text-foreground mb-3">
              Tout ce qui est inclus
            </div>
            <div className="bg-background border border-border rounded-xl overflow-hidden">
              {PREMIUM_FEATURES.map((f, i) => (
                <div
                  key={f.label}
                  className={`flex items-center gap-3 px-5 py-3.5 ${i !== 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon i={f.icon} size={16} className="text-primary" />
                  </div>
                  <span className="text-sm text-foreground font-headings font-bold">{f.label}</span>
                  <Icon i="check-circle" size={16} className="text-primary ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="font-headings font-bold text-base text-foreground">
              Ce qu&rsquo;ils en disent
            </div>
            {[
              {
                name: 'Cheikh B.',
                city: 'Pikine',
                text: 'Depuis Premium, je perds zéro franc. Chaque client reçoit son rappel WhatsApp.',
              },
              {
                name: 'Adja Ndiaye',
                city: 'Thiès',
                text: 'Les stats m’ont montré que 3 clients représentaient 80% de mes dettes.',
              },
            ].map((t) => (
              <div key={t.name} className="bg-background border border-border rounded-xl px-5 py-4">
                <p className="text-sm text-foreground leading-relaxed italic mb-3">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <span className="font-headings font-bold text-xs text-secondary-foreground">
                      {t.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-headings font-bold text-xs text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="px-4 pb-8 text-center text-xs text-muted-foreground">Chargement…</div>
      )}
    </div>
  );
}
