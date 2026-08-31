'use client';

// S'abonner à Premium — Banani's SAbonnerPremium.jsx (monthly-only, no
// annual — see .planning/banani/premium-checkout.md for translation notes
// and decisions). Reached from /premium's "Passer à Premium" CTA.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { PageTransition } from '@/components/jurali/PageTransition';
import { PhoneField } from '@/components/jurali/PhoneField';
import { formatPrice } from '@/lib/utils';
import { formatDateFr } from '@/lib/jurali-format';
import { PREMIUM_FEATURES } from '@/lib/jurali-premium';
import { tapScale } from '@/lib/motion';
import { findCountryByDialPrefix } from '@/lib/jurali-countries';

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
  totalClientCount: number;
}

interface SubscriptionData {
  isActive: boolean;
  planAmountFcfa: number;
}

interface CouponPreview {
  code: string;
  percentOff: number;
  discountedAmountFcfa: number;
}

const COUPON_ERROR_MESSAGES: Record<string, string> = {
  COUPON_NOT_FOUND: 'Code promo introuvable.',
  COUPON_INACTIVE: 'Ce code promo n’est plus actif.',
  COUPON_EXPIRED: 'Ce code promo a expiré.',
};

type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'FREE_MONEY' | 'MOBILE_MONEY' | 'CARD';

// Wave / Orange Money / Free Money are the Senegal-specific operators
// Bictorys lets us pre-select — shown only when the phone number's country
// is Sénégal. Any other country falls back to the generic "Mobile Money"
// option: Bictorys' hosted checkout auto-detects the country from the
// phone number and lists the right local operators itself (Wave/Orange/MTN
// in Côte d'Ivoire, Flooz/T-Money in Togo, etc.) — we can't reliably
// pre-name an operator we've never tested against their API. Carte
// bancaire needs no phone number and works from any country.
const SENEGAL_MOBILE_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'WAVE', label: 'Wave' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'FREE_MONEY', label: 'Free Money' },
];
const GENERIC_MOBILE_METHOD: { value: PaymentMethod; label: string } = {
  value: 'MOBILE_MONEY',
  label: 'Mobile Money',
};
const CARD_METHOD: { value: PaymentMethod; label: string } = {
  value: 'CARD',
  label: 'Carte bancaire',
};

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_SUBSCRIBED: 'Tu es déjà Premium.',
  PAYMENT_PROVIDER_UNCONFIGURED: 'Le paiement n’est pas encore configuré. Réessaie plus tard.',
  PAYMENT_PROVIDER_UNAVAILABLE:
    'Service de paiement temporairement indisponible. Réessaie dans un instant.',
  PAYMENT_IN_FLIGHT: 'Un paiement est déjà en cours. Réessaie dans quelques secondes.',
  PAYMENT_FAILED: 'Le paiement a échoué. Réessaie.',
  VALIDATION_FAILED: 'Vérifie ton numéro de téléphone.',
  // The coupon was re-validated server-side at charge time and no longer
  // holds (deactivated/expired between the preview and this submit) — rare,
  // but the preview above is never the source of truth.
  COUPON_NOT_FOUND: 'Le code promo appliqué n’est plus valide. Retire-le et réessaie.',
  COUPON_INACTIVE: 'Le code promo appliqué n’est plus actif. Retire-le et réessaie.',
  COUPON_EXPIRED: 'Le code promo appliqué a expiré. Retire-le et réessaie.',
};

export default function PremiumCheckoutPage() {
  const user = useUser();
  const router = useRouter();
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: sub } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });

  const [method, setMethod] = useState<PaymentMethod>('WAVE');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const isActive = sub?.isActive ?? false;
  useEffect(() => {
    if (isActive) router.replace('/premium/manage');
  }, [isActive, router]);

  if (!user || isActive) return null;

  const planAmount = sub?.planAmountFcfa ?? 2500;
  const totalAmount = appliedCoupon?.discountedAmountFcfa ?? planAmount;
  const renewsAt = formatDateFr(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

  const country = findCountryByDialPrefix(phone);
  const mobileMethods = country.iso2 === 'SN' ? SENEGAL_MOBILE_METHODS : [GENERIC_MOBILE_METHOD];
  const paymentMethods = [...mobileMethods, CARD_METHOD];
  const methodLabel = paymentMethods.find((m) => m.value === method)?.label ?? '';
  const isCard = method === 'CARD';

  // Switching country away from Sénégal while a Wave/Orange/Free button
  // was selected (or back to Sénégal from generic Mobile Money) would
  // otherwise leave `method` pointing at an option no longer shown.
  useEffect(() => {
    if (!isCard && !mobileMethods.some((m) => m.value === method)) {
      setMethod(mobileMethods[0]!.value);
    }
  }, [country.iso2]);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await api<CouponPreview>('/api/coupons/validate', {
        method: 'POST',
        body: { code },
      });
      setAppliedCoupon(res);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(
        err instanceof ApiError
          ? (COUPON_ERROR_MESSAGES[err.code] ?? err.message)
          : 'Erreur réseau. Réessaie.',
      );
    } finally {
      setCouponChecking(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  }

  async function subscribe() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ status: string; paymentUrl: string }>('/api/subscriptions', {
        method: 'POST',
        body: {
          paymentMethod: method,
          ...(!isCard && phone ? { phone } : {}),
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        },
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

  const summary = (
    <div className="bg-primary rounded-2xl p-6">
      <div className="font-headings font-bold text-sm text-secondary uppercase tracking-widest mb-5">
        Récapitulatif
      </div>
      <div
        className="flex flex-col gap-3 pb-4 mb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}
      >
        <div className="flex justify-between">
          <span className="text-sm text-secondary">Plan</span>
          <span className="font-headings font-bold text-sm text-primary-foreground">
            Premium Mensuel
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-secondary">Paiement</span>
          <span className="font-headings font-bold text-sm text-primary-foreground">
            {methodLabel}
          </span>
        </div>
        {!isCard && phone && (
          <div className="flex justify-between">
            <span className="text-sm text-secondary">Numéro</span>
            <span className="font-headings font-bold text-sm text-primary-foreground">{phone}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-sm text-secondary">Renouvellement</span>
          <span className="font-headings font-bold text-sm text-primary-foreground">
            {renewsAt}
          </span>
        </div>
        {appliedCoupon && (
          <div className="flex justify-between">
            <span className="text-sm text-secondary">
              Code promo <span className="text-primary-foreground">{appliedCoupon.code}</span>
            </span>
            <span className="font-headings font-bold text-sm text-primary-foreground">
              -{appliedCoupon.percentOff}%
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between items-end mb-6">
        <span className="font-headings font-bold text-sm text-secondary">Total aujourd’hui</span>
        <div className="text-right">
          {appliedCoupon && (
            <div className="text-xs text-secondary line-through">{formatPrice(planAmount)}</div>
          )}
          <div className="font-headings font-bold text-3xl text-primary-foreground">
            {formatPrice(totalAmount)}
          </div>
          <div className="text-xs text-secondary">FCFA</div>
        </div>
      </div>
      {error && <div className="text-sm text-accent mb-3">{error}</div>}
      <motion.button
        type="button"
        onClick={subscribe}
        disabled={submitting}
        whileTap={tapScale}
        className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-3.5 rounded-xl disabled:opacity-60"
      >
        <Icon i="crown" size={18} />
        {submitting ? 'Redirection…' : 'Payer maintenant'}
      </motion.button>
    </div>
  );

  return (
    <PageTransition>
      <div className="min-h-dvh bg-background font-body flex lg:flex-row">
        <div className="hidden lg:block">
          <DesktopSidebar
            displayName={user.shopName || user.email}
            fullName={user.name}
            totalDueFcfa={dashboard?.totalDueFcfa ?? 0}
            debtorCount={dashboard?.debtorCount ?? 0}
            overdueDueFcfa={dashboard?.overdueDueFcfa ?? 0}
            overdueDebtorCount={dashboard?.overdueDebtorCount ?? 0}
            loading={dashboardLoading}
            totalClientCount={dashboard?.totalClientCount ?? 0}
            isPremium={false}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-4 lg:px-8 pt-6 lg:pt-8 pb-5 border-b border-border">
            <Link
              href="/premium"
              className="w-10 h-10 rounded-lg bg-input border border-border flex items-center justify-center flex-shrink-0"
            >
              <Icon i="chevron-left" size={20} className="text-foreground" />
            </Link>
            <div>
              <div className="font-headings font-bold text-xl lg:text-2xl text-foreground">
                S’abonner à Premium
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Choisis ton moyen de paiement
              </div>
            </div>
          </div>

          <div className="px-4 lg:px-8 py-6 lg:py-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Mobile: summary first so the CTA is reachable without scrolling past the form */}
            <div className="lg:hidden">{summary}</div>

            <div className="flex-1 flex flex-col gap-5 min-w-0">
              <div className="bg-background border border-border rounded-xl p-5">
                <div className="font-headings font-bold text-base text-foreground mb-1">
                  Premium Mensuel
                </div>
                <div className="font-headings font-bold text-3xl text-primary">
                  {formatPrice(planAmount)}{' '}
                  <span className="text-sm font-body font-normal text-muted-foreground">
                    FCFA/mois
                  </span>
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-5">
                <div className="font-headings font-bold text-base text-foreground mb-4">
                  Moyen de paiement
                </div>
                <div className="flex flex-col gap-2">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={`text-left rounded-xl px-4 py-3 flex items-center gap-3 min-h-[48px] ${
                        method === m.value ? 'border-2 border-primary' : 'border border-border'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          method === m.value ? 'bg-secondary' : 'bg-input'
                        }`}
                      >
                        <Icon
                          i={m.value === 'CARD' ? 'credit-card' : 'smartphone'}
                          size={18}
                          className={
                            method === m.value
                              ? 'text-secondary-foreground'
                              : 'text-muted-foreground'
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-headings font-bold text-sm text-foreground">
                          {m.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.value === 'CARD' ? 'Visa, Mastercard' : 'Mobile Money'}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          method === m.value ? 'border-primary' : 'border-border'
                        }`}
                      >
                        {method === m.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {!isCard && (
                <div className="bg-background border border-border rounded-xl p-5">
                  <div className="font-headings font-bold text-base text-foreground mb-1">
                    Numéro {methodLabel}
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Choisis le pays puis le numéro sur lequel initier le paiement
                  </div>
                  <PhoneField value={phone} onChange={setPhone} showLabel={false} />
                </div>
              )}

              <div className="bg-background border border-border rounded-xl p-5">
                <div className="font-headings font-bold text-base text-foreground mb-1">
                  Code promo
                </div>
                <div className="text-xs text-muted-foreground mb-3">Optionnel</div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-3 bg-input border border-border rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon i="tag" size={16} className="text-primary" />
                      <span className="text-sm font-headings font-bold text-foreground">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-xs text-primary">-{appliedCoupon.percentOff}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs font-headings font-bold text-muted-foreground px-3 py-2 min-h-[40px]"
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void applyCoupon();
                        }
                      }}
                      placeholder="SUMMER20"
                      disabled={couponChecking}
                      className="flex-1 bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponChecking || !couponInput.trim()}
                      className="flex-shrink-0 bg-input border border-border font-headings font-bold text-sm text-foreground px-4 py-3 rounded-lg disabled:opacity-50"
                    >
                      {couponChecking ? '…' : 'Appliquer'}
                    </button>
                  </div>
                )}
                {couponError && <div className="text-xs text-danger mt-2">{couponError}</div>}
              </div>
            </div>

            <div className="flex flex-col gap-5 lg:w-[340px] lg:flex-shrink-0">
              <div className="hidden lg:block">{summary}</div>

              <div className="bg-background border border-border rounded-xl p-5">
                <div className="font-headings font-bold text-sm text-foreground mb-3">
                  Ce que tu obtiens
                </div>
                <div className="flex flex-col gap-2.5">
                  {PREMIUM_FEATURES.map((f) => (
                    <div key={f.label} className="flex items-center gap-2">
                      <Icon i="check-circle" size={14} className="text-primary flex-shrink-0" />
                      <span className="text-sm text-foreground">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 px-4 py-3 bg-input rounded-lg">
                <Icon i="shield" size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  Résiliation possible à tout moment depuis la Gestion Premium. Aucun engagement à
                  long terme.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
