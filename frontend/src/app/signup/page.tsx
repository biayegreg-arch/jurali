'use client';

// Inscription — PRD 3.1 / US-08. Reproduces Banani's Inscription.jsx; see
// .planning/banani/inscription.md for translation notes and decisions.
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { GoogleSignInButton } from '@/components/jurali/GoogleSignInButton';
import { PhoneField } from '@/components/jurali/PhoneField';

const ERROR_MESSAGES: Record<string, string> = {
  PHONE_ALREADY_EXISTS: 'Ce numéro est déjà utilisé — connecte-toi plutôt.',
  PASSWORD_BANNED: 'Ce mot de passe est trop courant.',
  PASSWORD_TOO_SHORT: 'Mot de passe trop court.',
  PASSWORD_PWNED: 'Ce mot de passe a fuité — choisis-en un autre.',
  VALIDATION_FAILED: 'Vérifie les champs du formulaire.',
  TOO_MANY_PHONE_SIGNUP_ATTEMPTS: 'Trop de tentatives — réessaie plus tard.',
};

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 &&
    phone.length > 0 &&
    shopName.trim().length > 0 &&
    password.length > 0 &&
    acceptedTerms &&
    !submitting;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/phone-signup', {
        method: 'POST',
        body: {
          name: name.trim(),
          phone,
          shopName: shopName.trim(),
          password,
        },
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
    <div className="min-h-dvh bg-background font-body flex flex-col lg:flex-row">
      {/* Brand panel — desktop only (lg+), matches Banani's 560px left panel */}
      <div className="hidden lg:flex bg-primary flex-col justify-between px-12 py-12 flex-shrink-0 w-[560px]">
        <div>
          <Link href="/" className="font-headings font-bold text-3xl text-primary-foreground">
            Jurali
          </Link>
          <div className="text-sm text-secondary mt-1">Gestion des dettes simplifiée</div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="bg-primary-foreground/10 rounded-2xl px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-headings font-bold text-base text-primary-foreground">
                Total dû
              </div>
              <span className="text-xs text-secondary px-2 py-1 rounded-lg bg-primary-foreground/15">
                Aujourd&rsquo;hui
              </span>
            </div>
            <div className="font-headings font-bold text-4xl text-primary-foreground mb-1">
              148 750
            </div>
            <div className="text-sm text-secondary">FCFA · 8 clients</div>
            <div className="flex flex-col gap-2 mt-5">
              {[
                { name: 'Fatou Diallo', amount: '12 500', overdue: false },
                { name: 'Cheikh Diop', amount: '63 300', overdue: true },
                { name: 'Ibrahima Fall', amount: '31 000', overdue: true },
              ].map((c) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-headings font-bold text-xs text-primary bg-primary-foreground/20">
                      {c.name.charAt(0)}
                    </div>
                    <span className="text-sm text-primary-foreground">{c.name}</span>
                  </div>
                  <span
                    className={`text-sm font-headings font-bold ${c.overdue ? 'text-accent' : 'text-primary-foreground'}`}
                  >
                    {c.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-base text-secondary leading-relaxed italic">
              &ldquo;Avant j&rsquo;écrivais tout sur papier. Maintenant en 3 secondes la dette est
              enregistrée.&rdquo;
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary-foreground/20">
                <span className="font-headings font-bold text-sm text-primary-foreground">M</span>
              </div>
              <div>
                <div className="font-headings font-bold text-sm text-primary-foreground">
                  Mamadou D.
                </div>
                <div className="text-xs text-secondary">Boutiquier — Dakar</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-secondary">
          © 2026 Jurali · Conçu pour les commerçants du Sénégal
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 lg:px-16">
        <div className="w-full max-w-[440px]">
          {/* Mobile-only compact wordmark (desktop shows the brand panel instead) */}
          <div className="mb-6 lg:hidden">
            <Link href="/" className="font-headings font-bold text-2xl text-primary">
              Jurali
            </Link>
            <div className="text-xs text-muted-foreground">Gestion des dettes simplifiée</div>
          </div>

          <div className="mb-8">
            <div className="font-headings font-bold text-2xl lg:text-3xl text-foreground mb-2">
              Créer un compte
            </div>
            <div className="text-sm text-muted-foreground">
              Rejoins des milliers de boutiquiers qui gèrent leurs dettes avec Jurali
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2 block">
                Nom complet
              </label>
              <div className="flex items-center gap-3 bg-input border border-border rounded-xl px-4 py-3.5">
                <Icon i="user" size={18} className="text-muted-foreground flex-shrink-0" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mamadou Diallo"
                  autoComplete="name"
                  className="flex-1 bg-transparent text-base text-foreground placeholder-muted-foreground outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2 block">
                Téléphone
              </label>
              <PhoneField
                value={phone}
                onChange={setPhone}
                showLabel={false}
                helper="Utilisé pour les rappels WhatsApp"
              />
            </div>

            <div>
              <label className="text-xs font-headings font-bold uppercase tracking-wide text-foreground mb-2 block">
                Nom de ta boutique
              </label>
              <div className="flex items-center gap-3 bg-input border border-border rounded-xl px-4 py-3.5">
                <Icon i="store" size={18} className="text-muted-foreground flex-shrink-0" />
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Boutique Diallo"
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
                  autoComplete="new-password"
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

            <button
              type="button"
              onClick={() => setAcceptedTerms((v) => !v)}
              className="flex items-start gap-3 mt-1 text-left"
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${acceptedTerms ? 'bg-primary' : 'bg-input border border-border'}`}
              >
                {acceptedTerms && <Icon i="check" size={12} className="text-primary-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                J&rsquo;accepte les{' '}
                <span className="text-primary font-bold">conditions d&rsquo;utilisation</span> et la{' '}
                <span className="text-primary font-bold">politique de confidentialité</span> de
                Jurali
              </p>
            </button>

            {error && <div className="text-sm text-danger">{error}</div>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl mt-2 disabled:opacity-50"
            >
              <Icon i="user-plus" size={20} />
              {submitting ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>

          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <GoogleSignInButton next="/dashboard" />

          <div className="text-center text-sm text-muted-foreground mt-5">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-primary font-bold">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
