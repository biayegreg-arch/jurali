'use client';

// Créer client — Banani's `CreateClientDesktop.jsx` (2026-08-26). Reachable
// from New Debt's "Créer client" button (desktop) and directly at
// /clients/new. `?next=` carries the caller back with the new client
// preselected (reuses New Debt's existing `?clientId=` preset-loading
// logic — no new wiring needed there beyond the link itself).
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { NotificationBell } from '@/components/jurali/TopBar';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import {
  ClientForm,
  ClientFormInfoPanel,
  type ClientFormValues,
} from '@/components/jurali/ClientForm';

const ERROR_MESSAGES: Record<string, string> = {
  CLIENT_LIMIT_REACHED: 'Limite de 10 clients gratuits atteinte — passe à Premium pour continuer.',
  VALIDATION_FAILED: 'Vérifie les champs du formulaire (numéro de téléphone ou email invalide).',
};

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

const EMPTY: ClientFormValues = { firstName: '', phone: '', email: '', address: '' };

export default function CreateClientPage() {
  return (
    <Suspense fallback={null}>
      <CreateClientPageContent />
    </Suspense>
  );
}

function CreateClientPageContent() {
  const user = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const next = params.get('next');
  const cancelHref = next ?? '/clients';

  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });

  const [values, setValues] = useState<ClientFormValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function submit() {
    if (!values.firstName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/api/clients', {
        method: 'POST',
        body: {
          firstName: values.firstName.trim(),
          ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
          ...(values.email.trim() ? { email: values.email.trim() } : {}),
          ...(values.address.trim() ? { address: values.address.trim() } : {}),
        },
      });
      toast('Client créé', 'success');
      router.push(next ? `${next}?clientId=${created.id}` : `/clients/${created.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ERROR_MESSAGES[err.code] ?? err.message)
          : 'Une erreur est survenue. Réessaie.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = user.shopName || user.email;

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
        totalClientCount={dashboard?.totalClientCount ?? 0}
        isPremium={subscription?.isActive ?? false}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="bg-primary px-4 pt-10 pb-6 lg:hidden">
          <div className="flex items-center gap-3">
            <Link
              href={cancelHref}
              className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
            >
              <Icon i="chevron-left" size={20} className="text-primary-foreground" />
            </Link>
            <div className="font-headings font-bold text-lg text-primary-foreground">
              Créer un client
            </div>
          </div>
        </div>

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
          <div className="flex items-center gap-3">
            <Link
              href={cancelHref}
              className="w-9 h-9 rounded-lg bg-input border border-border flex items-center justify-center"
            >
              <Icon i="chevron-left" size={20} className="text-foreground" />
            </Link>
            <div>
              <div className="font-headings font-bold text-2xl text-foreground">
                Créer un nouveau client
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Remplis les informations de base
              </div>
            </div>
          </div>
          <NotificationBell count={notifData?.count} />
        </div>

        <div className="flex-1 px-4 lg:px-8 pt-5 lg:pt-8 pb-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
          <ClientForm
            mode="create"
            values={values}
            onChange={setValues}
            onSubmit={submit}
            submitting={submitting}
            error={error}
            cancelHref={cancelHref}
          />
          <ClientFormInfoPanel />
        </div>
      </div>
    </div>
  );
}
