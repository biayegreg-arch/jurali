// Paramètres — PRD 3.7. Reproduces Banani's Parametres.jsx (restyle of the
// existing generic /settings page, same URL, same logic); see
// .planning/banani/parametres.md for translation notes and decisions.
//
// Real flows kept from the starter: change/set password, Google OAuth
// link, logout. Notifications/Données/Langue sections are omitted or
// static-only — no backend exists yet for those, see the plan file.
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth, useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { SettingsSection, SettingsRow } from '@/components/jurali/SettingsSection';

interface SubscriptionData {
  isActive: boolean;
}

export default function SettingsPage() {
  const user = useUser();
  const { refresh, logout } = useAuth();
  const { toast } = useToast();
  const { data: subscription } = useApi<SubscriptionData>('/api/subscriptions', { skip: !user });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  if (!user) return null;

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
        await api('/api/auth/set-password', {
          method: 'POST',
          body: { newPassword },
        });
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
    <div className="min-h-dvh bg-background font-body flex flex-col">
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
        <SettingsSection title="Profil">
          <SettingsRow icon="mail" label="Email" value={user.email} last />
        </SettingsSection>

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

        <AutoReminderSection isPremium={subscription?.isActive ?? false} />

        <SettingsSection title="Langue & Devise">
          <SettingsRow icon="globe" label="Langue" value="Français" />
          <SettingsRow icon="credit-card" label="Devise" value="FCFA" last />
        </SettingsSection>

        <div className="bg-input border border-border rounded-xl px-5 py-4">
          <div className="font-headings font-bold text-sm text-foreground">Jurali</div>
          <div className="text-xs text-muted-foreground">Conçu pour les boutiquiers</div>
        </div>
      </div>
    </div>
  );
}

function AutoReminderSection({ isPremium }: { isPremium: boolean }) {
  const { data, loading } = useApi<{ enabled: boolean }>('/api/settings/auto-reminders', {
    skip: !isPremium,
  });
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const current = enabled ?? data?.enabled ?? false;

  async function toggle() {
    if (saving) return;
    const next = !current;
    setEnabled(next);
    setSaving(true);
    try {
      await api('/api/settings/auto-reminders', { method: 'PATCH', body: { enabled: next } });
    } catch {
      setEnabled(!next); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection title="Notifications & Rappels">
      {isPremium ? (
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Icon i="message-circle" size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headings font-bold text-sm text-foreground">
              Rappels WhatsApp automatiques
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Te notifie dès qu’une dette dépasse 7 jours sans rappel envoyé
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
      ) : (
        <Link href="/premium" className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Icon i="message-circle" size={18} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headings font-bold text-sm text-muted-foreground">
              Rappels WhatsApp automatiques
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
