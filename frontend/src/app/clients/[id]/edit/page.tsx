'use client';

// Modifier client — real edit flow behind Fiche client's "Modifier" button
// (2026-08-26 decision: build PATCH /api/clients/[id] rather than leave the
// button inert). Reuses the same `ClientForm` as /clients/new.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
}

interface ClientDetail {
  id: string;
  firstName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

const EMPTY: ClientFormValues = { firstName: '', phone: '', email: '', address: '' };

export default function EditClientPage() {
  const user = useUser();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const cancelHref = `/clients/${params.id}`;

  const {
    data: client,
    loading: clientLoading,
    error: clientError,
  } = useApi<ClientDetail>(`/api/clients/${params.id}`);
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });

  const [values, setValues] = useState<ClientFormValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setValues({
        firstName: client.firstName,
        phone: client.phone ?? '',
        email: client.email ?? '',
        address: client.address ?? '',
      });
    }
  }, [client]);

  if (!user) return null;

  async function submit() {
    if (!values.firstName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/clients/${params.id}`, {
        method: 'PATCH',
        body: {
          firstName: values.firstName.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          address: values.address.trim(),
        },
      });
      toast('Client mis à jour', 'success');
      router.push(`/clients/${params.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = user.shopName || user.email;

  if (clientLoading) {
    return (
      <div className="min-h-dvh bg-background font-body flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="min-h-dvh bg-background font-body flex flex-col items-center justify-center gap-3 text-center px-4">
        <div className="text-sm text-muted-foreground">Client introuvable.</div>
        <Link href="/clients" className="text-sm text-primary font-bold">
          Retour à la liste
        </Link>
      </div>
    );
  }

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

      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-primary px-4 pt-10 pb-6 lg:hidden">
          <div className="flex items-center gap-3">
            <Link
              href={cancelHref}
              className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
            >
              <Icon i="chevron-left" size={20} className="text-primary-foreground" />
            </Link>
            <div className="font-headings font-bold text-lg text-primary-foreground">
              Modifier {client.firstName}
            </div>
          </div>
        </div>

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
                Modifier {client.firstName}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Mets à jour les informations du client
              </div>
            </div>
          </div>
          <NotificationBell count={notifData?.count} />
        </div>

        <div className="flex-1 px-4 lg:px-8 pt-5 lg:pt-8 pb-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
          <ClientForm
            mode="edit"
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
