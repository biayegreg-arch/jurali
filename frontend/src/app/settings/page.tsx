// Paramètres — PRD 3.7. Mobile reproduces the existing generic /settings
// page restyle (Phase 5). Desktop (lg+) reproduces Banani's later
// `Parametres.jsx` desktop redesign (2026-08-26) — sidebar + 2-column
// layout with a real profile-edit flow, a second (14-day) reminder toggle,
// and a Premium CSV export. See .planning/banani/parametres.md.
'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth, useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { NotificationBell } from '@/components/jurali/TopBar';
import { DesktopSidebar } from '@/components/jurali/DesktopSidebar';
import { SettingsSection, SettingsRow } from '@/components/jurali/SettingsSection';
import { useExportDebtsCsv } from '@/lib/useExportDebtsCsv';
import { AUTO_REMINDER_THRESHOLD_DAYS } from '@/lib/server/jurali/auto-reminder';
import { OVERDUE_ALERT_THRESHOLD_DAYS } from '@/lib/server/jurali/overdue-alert';

interface SubscriptionData {
  isActive: boolean;
}

interface DashboardData {
  totalDueFcfa: number;
  debtorCount: number;
  overdueDueFcfa: number;
  overdueDebtorCount: number;
}

function usePremiumToggle(endpoint: string, skip: boolean) {
  const { data, loading } = useApi<{ enabled: boolean }>(endpoint, { skip });
  const [override, setOverride] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const current = override ?? data?.enabled ?? false;

  async function toggle() {
    if (saving) return;
    const next = !current;
    setOverride(next);
    setSaving(true);
    try {
      await api(endpoint, { method: 'PATCH', body: { enabled: next } });
    } catch {
      setOverride(!next);
    } finally {
      setSaving(false);
    }
  }

  return { current, loading, saving, toggle };
}

export default function SettingsPage() {
  const user = useUser();
  const { refresh, logout } = useAuth();
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });
  const isPremium = subscription?.isActive ?? false;
  const { data: dashboard, loading: dashboardLoading } = useApi<DashboardData>('/api/dashboard', {
    skip: !user,
  });
  const { data: notifData } = useApi<{ count: number }>('/api/notifications/count', {
    skip: !user,
  });

  const autoReminder = usePremiumToggle('/api/settings/auto-reminders', !isPremium);
  const overdueAlert = usePremiumToggle('/api/settings/overdue-alerts', !isPremium);

  if (!user) return null;

  const displayName = user.shopName || user.email;
  const sharedProps = { user, isPremium, autoReminder, overdueAlert, refresh, logout };

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

      {/* Mobile/tablet (< lg) — single column, unchanged structure */}
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
                Paramètres
              </div>
              <div className="text-xs text-secondary">Gérer ton compte</div>
            </div>
          </div>
        </div>

        <div className="px-4 pt-5 pb-8 flex flex-col gap-6 max-w-lg w-full mx-auto">
          <ProfileSection {...sharedProps} />
          <SecuritySection {...sharedProps} />
          <NotificationsSection {...sharedProps} />
          <SettingsSection title="Analyse">
            <Link href="/stats" className="w-full flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <Icon i="bar-chart-2" size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-headings font-bold text-sm text-foreground">Statistiques</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Taux de recouvrement, tendances sur 6 mois
                </div>
              </div>
              <Icon i="chevron-right" size={16} className="text-muted-foreground flex-shrink-0" />
            </Link>
          </SettingsSection>
          <DataSection isPremium={isPremium} />
          <LangSection />
          <AppInfoBlock />
        </div>
      </div>

      {/* Desktop (lg+) — Parametres.jsx 2-column layout */}
      <div className="hidden lg:flex flex-1 flex-col">
        <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
          <div>
            <div className="font-headings font-bold text-2xl text-foreground">Paramètres</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Gérer ton compte et tes préférences
            </div>
          </div>
          <NotificationBell count={notifData?.count} />
        </div>

        <div className="flex gap-8 px-8 pt-8 pb-8">
          <div className="flex-1 flex flex-col gap-6">
            <ProfileSection {...sharedProps} />
            <NotificationsSection {...sharedProps} />
          </div>
          <div className="flex flex-col gap-6 w-[400px] flex-shrink-0">
            <SecuritySection {...sharedProps} />
            <DataSection isPremium={isPremium} />
            <LangSection />
            <AppInfoBlock />
          </div>
        </div>
      </div>
    </div>
  );
}

interface User {
  email: string;
  name: string | null;
  shopName: string | null;
  phone: string | null;
  address: string | null;
  hasPassword: boolean;
  linkedProviders: string[];
}

function ProfileSection({ user, refresh }: { user: User; refresh: () => Promise<void> }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? '');
  const [shopName, setShopName] = useState(user.shopName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [address, setAddress] = useState(user.address ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/auth/me', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          shopName: shopName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        },
      });
      toast('Profil mis à jour.', 'success');
      setEditing(false);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'PHONE_ALREADY_EXISTS' ? 'Ce numéro est déjà utilisé.' : err.message);
      } else {
        setError('Erreur réseau. Réessaie.');
      }
    } finally {
      setSaving(false);
    }
  }

  const subtitle = [user.shopName, user.address].filter(Boolean).join(' · ');

  return (
    <SettingsSection title="Profil & Boutique">
      <div className={`px-5 py-5 ${editing ? '' : 'border-b border-border'}`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
            <span className="font-headings font-bold text-lg text-secondary-foreground">
              {(user.name || user.shopName || user.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headings font-bold text-base text-foreground truncate">
              {user.name || user.shopName || user.email}
            </div>
            {subtitle && <div className="text-sm text-muted-foreground truncate">{subtitle}</div>}
            {user.phone && <div className="text-xs text-muted-foreground mt-0.5">{user.phone}</div>}
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-2 bg-input border border-border text-foreground font-headings font-bold text-xs px-3 py-2 rounded-lg flex-shrink-0"
          >
            <Icon i="pencil" size={14} />
            Modifier
          </button>
        </div>

        {editing && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom complet"
              className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
            />
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Nom de la boutique"
              className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 123 45 67"
              className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Adresse (ex. Médina, Dakar)"
              className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
            />
            {error && <div className="text-sm text-danger">{error}</div>}
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground font-headings font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>

      <SettingsRow icon="mail" label="Email" value={user.email} />
      <SettingsRow icon="store" label="Nom de la boutique" value={user.shopName ?? '—'} />
      <SettingsRow icon="map-pin" label="Adresse" value={user.address ?? '—'} />
      <SettingsRow icon="phone" label="Téléphone" value={user.phone ?? '—'} last />
    </SettingsSection>
  );
}

function SecuritySection({
  user,
  logout,
  refresh,
}: {
  user: User;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const hasPassword = user.hasPassword;
  const googleLinked = user.linkedProviders.includes('google');

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length === 0) {
      setError('Saisis un nouveau mot de passe.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSubmitting(true);
    try {
      if (hasPassword) {
        await api('/api/auth/change-password', {
          method: 'PUT',
          body: { currentPassword, newPassword },
        });
        toast('Mot de passe mis à jour.', 'success');
      } else {
        await api('/api/auth/set-password', { method: 'POST', body: { newPassword } });
        toast('Mot de passe défini.', 'success');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {
          INVALID_CREDENTIALS: 'Mot de passe actuel incorrect.',
          PASSWORD_BANNED: 'Ce mot de passe est trop courant.',
          PASSWORD_TOO_SHORT: err.message || 'Mot de passe trop court.',
          PASSWORD_PWNED: 'Ce mot de passe a fuité — choisis-en un autre.',
          PASSWORD_ALREADY_SET: 'Un mot de passe est déjà défini.',
          VALIDATION_FAILED: 'Champs invalides.',
        };
        setError(map[err.code] ?? err.message);
      } else {
        setError('Erreur réseau. Réessaie.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsSection title="Sécurité">
      <div className={`px-5 py-4 ${showPasswordForm ? '' : 'border-b border-border'}`}>
        <button
          type="button"
          onClick={() => setShowPasswordForm((v) => !v)}
          className="w-full flex items-center gap-4"
        >
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Icon i="lock" size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="font-headings font-bold text-sm text-foreground">
              {hasPassword ? 'Mot de passe' : 'Définir un mot de passe'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {hasPassword
                ? 'Modifier ton mot de passe'
                : 'Tu t’es connecté via Google — ajoute un mot de passe'}
            </div>
          </div>
          <Icon
            i={showPasswordForm ? 'chevron-down' : 'chevron-right'}
            size={16}
            className="text-muted-foreground flex-shrink-0"
          />
        </button>

        {showPasswordForm && (
          <form onSubmit={onSubmitPassword} className="mt-4 flex flex-col gap-3">
            {hasPassword && (
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Mot de passe actuel"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
              />
            )}
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
            />
            {error && <div className="text-sm text-danger">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground font-headings font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>

      <SettingsRow
        icon="link"
        label="Google"
        description={googleLinked ? 'Compte lié' : 'Non lié'}
      />
      {!googleLinked && (
        <div className="px-5 pb-4 -mt-2">
          <a
            href="/api/auth/oauth/google/start?next=/settings"
            className="text-xs text-primary font-bold"
          >
            Lier mon compte Google
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => void logout()}
        className="w-full flex items-center gap-4 px-5 py-4"
      >
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
          <Icon i="log-out" size={18} className="text-primary" />
        </div>
        <div className="flex-1 text-left font-headings font-bold text-sm text-foreground">
          Se déconnecter
        </div>
      </button>
    </SettingsSection>
  );
}

interface ToggleState {
  current: boolean;
  loading: boolean;
  saving: boolean;
  toggle: () => void;
}

function NotificationsSection({
  isPremium,
  autoReminder,
  overdueAlert,
}: {
  isPremium: boolean;
  autoReminder: ToggleState;
  overdueAlert: ToggleState;
}) {
  return (
    <SettingsSection title="Notifications & Rappels">
      <ToggleRow
        icon="message-circle"
        label="Rappels WhatsApp automatiques"
        description={`Envoyer un rappel ${AUTO_REMINDER_THRESHOLD_DAYS} jours après la dette`}
        isPremium={isPremium}
        state={autoReminder}
      />
      <ToggleRow
        icon="bell"
        label="Notifications dettes en retard"
        description={`Alerte quotidienne si des dettes dépassent ${OVERDUE_ALERT_THRESHOLD_DAYS} jours`}
        isPremium={isPremium}
        state={overdueAlert}
      />
      <SettingsRow
        icon="clock"
        label="Délai de rappel par défaut"
        value={`${AUTO_REMINDER_THRESHOLD_DAYS} jours`}
        last
      />
    </SettingsSection>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  isPremium,
  state,
}: {
  icon: string;
  label: string;
  description: string;
  isPremium: boolean;
  state: ToggleState;
}) {
  if (!isPremium) {
    return (
      <Link href="/premium" className="flex items-center gap-4 px-5 py-4 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
          <Icon i={icon} size={18} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-headings font-bold text-sm text-muted-foreground">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Réservé à Premium</div>
        </div>
        <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-2.5 py-1 rounded-lg flex-shrink-0">
          Premium
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
        <Icon i={icon} size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-headings font-bold text-sm text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={state.current}
        disabled={state.loading || state.saving}
        onClick={state.toggle}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 ${
          state.current ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
            state.current ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function DataSection({ isPremium }: { isPremium: boolean }) {
  const { exporting, error, exportCsv } = useExportDebtsCsv();

  return (
    <SettingsSection title="Données">
      {isPremium ? (
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="w-full flex items-center gap-4"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <Icon i="download" size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="font-headings font-bold text-sm text-foreground">
                Exporter toutes les dettes
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {exporting ? 'Préparation…' : 'Télécharger en CSV'}
              </div>
            </div>
          </button>
          {error && <div className="text-xs text-danger mt-2">{error}</div>}
        </div>
      ) : (
        <Link href="/premium" className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Icon i="download" size={18} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headings font-bold text-sm text-muted-foreground">
              Exporter toutes les dettes
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Réservé à Premium</div>
          </div>
          <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-2.5 py-1 rounded-lg flex-shrink-0">
            Premium
          </span>
        </Link>
      )}
    </SettingsSection>
  );
}

function LangSection(): ReactNode {
  return (
    <SettingsSection title="Langue & Devise">
      <SettingsRow icon="globe" label="Langue" value="Français" />
      <SettingsRow icon="credit-card" label="Devise" value="FCFA" last />
    </SettingsSection>
  );
}

function AppInfoBlock() {
  return (
    <div className="bg-input border border-border rounded-xl px-5 py-4">
      <div className="font-headings font-bold text-sm text-foreground">Jurali</div>
      <div className="text-xs text-muted-foreground">Conçu pour les boutiquiers</div>
    </div>
  );
}
