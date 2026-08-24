'use client';

// Se connecter — companion to /signup, no Banani source for this screen
// (same treatment as Phase 4's Paiement reçu: built fresh in the Jurali
// visual system). See .planning/banani/inscription.md.
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { GoogleSignInButton } from '@/components/jurali/GoogleSignInButton';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Numéro ou mot de passe incorrect.',
  LOCKED_OUT: 'Compte temporairement bloqué — réessaie plus tard.',
  ACCOUNT_SUSPENDED: 'Ce compte a été suspendu.',
  VALIDATION_FAILED: 'Vérifie les champs du formulaire.',
  TOO_MANY_PHONE_LOGIN_ATTEMPTS: 'Trop de tentatives — réessaie plus tard.',
};

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [localPhone, setLocalPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = localPhone.replace(/\s/g, '').length >= 8 && password.length > 0 && !submitting;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/phone-login', {
        method: 'POST',
        body: { phone: `+221${localPhone.replace(/\s/g, '')}`, password },
      });
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Erreur réseau. Réessaie.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background font-body flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8">
          <Link
            href="/"
            className="font-headings font-bold text-2xl text-primary mb-1 inline-block"
          >
            Jurali
          </Link>
          <div className="font-headings font-bold text-2xl text-foreground mb-2">Se connecter</div>
          <div className="text-sm text-muted-foreground">
            Retrouve tes clients et leurs dettes en un instant
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2 block">
              Téléphone
            </label>
            <div className="flex items-center gap-3 bg-input border border-border rounded-xl px-4 py-3.5">
              <span className="text-base text-muted-foreground flex-shrink-0">+221</span>
              <div className="w-px h-5 bg-border flex-shrink-0" />
              <input
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="77 123 45 67"
                inputMode="tel"
                autoComplete="tel-national"
                className="flex-1 bg-transparent text-base text-foreground placeholder-muted-foreground outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2 block">
              Mot de passe
            </label>
            <div className="flex items-center gap-3 bg-input border-2 border-primary rounded-xl px-4 py-3.5">
              <Icon i="lock" size={18} className="text-muted-foreground flex-shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="flex-1 bg-transparent text-base text-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex-shrink-0"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <Icon
                  i={showPassword ? 'eye' : 'eye-off'}
                  size={18}
                  className="text-muted-foreground"
                />
              </button>
            </div>
          </div>

          {error && <div className="text-sm text-danger">{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl mt-2 disabled:opacity-50"
          >
            <Icon i="log-in" size={20} />
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <GoogleSignInButton next="/dashboard" />

        <div className="text-center text-sm text-muted-foreground mt-5">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="text-primary font-bold">
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  );
}
