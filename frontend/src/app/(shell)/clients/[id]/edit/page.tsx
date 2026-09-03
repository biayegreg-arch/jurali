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
import { useApi, invalidateAllCache } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { NotificationBell } from '@/components/jurali/TopBar';
import {
  ClientForm,
  ClientFormInfoPanel,
  type ClientFormValues,
} from '@/components/jurali/ClientForm';

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: 'Vérifie les champs du formulaire (numéro de téléphone ou email invalide).',
};

interface SubscriptionData {
  isActive: boolean;
}

interface ClientDetail {
  id: string;
  firstName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  autoReminderEnabled: boolean;
  autoReminderThresholdDays: number | null;
  overdueAlertThresholdDays: number | null;
}

const EMPTY: ClientFormValues = {
  firstName: '',
  phone: '',
  email: '',
  address: '',
  autoReminderEnabled: true,
  autoReminderThresholdDays: '',
  overdueAlertThresholdDays: '',
};

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
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
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
        autoReminderEnabled: client.autoReminderEnabled,
        autoReminderThresholdDays: client.autoReminderThresholdDays?.toString() ?? '',
        overdueAlertThresholdDays: client.overdueAlertThresholdDays?.toString() ?? '',
      });
    }
  }, [client]);

  if (!user) return null;

  async function submit() {
    if (!values.firstName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const autoReminderThresholdDays = values.autoReminderThresholdDays.trim()
        ? Number.parseInt(values.autoReminderThresholdDays, 10)
        : null;
      const overdueAlertThresholdDays = values.overdueAlertThresholdDays.trim()
        ? Number.parseInt(values.overdueAlertThresholdDays, 10)
        : null;
      await api(`/api/clients/${params.id}`, {
        method: 'PATCH',
        body: {
          firstName: values.firstName.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          address: values.address.trim(),
          autoReminderEnabled: values.autoReminderEnabled,
          autoReminderThresholdDays,
          overdueAlertThresholdDays,
        },
      });
      invalidateAllCache();
      toast('Client mis à jour', 'success');
      router.push(`/clients/${params.id}`);
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
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-primary px-4 pt-10 pb-6 lg:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={cancelHref}
            className="w-10 h-10 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
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

      <div className="flex-1 px-4 lg:px-8 pt-5 lg:pt-8 pb-8 flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-lg lg:max-w-none w-full mx-auto lg:mx-0">
        <ClientForm
          mode="edit"
          values={values}
          onChange={setValues}
          onSubmit={submit}
          submitting={submitting}
          error={error}
          cancelHref={cancelHref}
          isPremium={subscription?.isActive ?? false}
        />
        <ClientFormInfoPanel />
      </div>
    </div>
  );
}
