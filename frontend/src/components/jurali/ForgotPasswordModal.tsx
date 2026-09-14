'use client';

// "Mot de passe oublié" flow, triggered from /login. Mirrors
// PendingEmailModal's popup + 8-char code pattern for visual/UX
// consistency, but chains two backend calls:
//   1. POST /api/auth/forgot-password { email } — enumeration-resistant,
//      always looks like it worked regardless of whether the email is on
//      file, so the "sent" step's copy must never claim certainty either.
//   2. POST /api/auth/reset-password { email, code, newPassword } — consumes
//      the code and updates the password. Issues no cookies (by design),
//      so on success we just close the modal and let the shopkeeper log in
//      fresh on the page underneath with their new password.
import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/jurali/Icon';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export interface ForgotPasswordModalProps {
  onClose: () => void;
}

type Step = 'email' | 'sent' | 'reset';

const FORGOT_ERRORS: Record<string, string> = {
  VALIDATION_FAILED: 'Adresse email invalide.',
  TOO_MANY_FORGOT_ATTEMPTS: 'Trop de demandes — réessaie plus tard.',
};

const RESET_ERRORS: Record<string, string> = {
  VALIDATION_FAILED: 'Vérifie les champs du formulaire.',
  PASSWORD_BANNED: 'Ce mot de passe est trop courant.',
  PASSWORD_TOO_SHORT: 'Mot de passe trop court.',
  PASSWORD_PWNED: 'Ce mot de passe a fuité — choisis-en un autre.',
  VERIFICATION_CODE_INVALID: 'Code invalide.',
  VERIFICATION_CODE_EXPIRED: 'Code expiré — redemande un email.',
  TOO_MANY_RESET_ATTEMPTS: 'Trop de tentatives — réessaie plus tard.',
};

export function ForgotPasswordModal({ onClose }: ForgotPasswordModalProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    onClose();
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setStep('sent');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (FORGOT_ERRORS[err.code] ?? err.message)
          : 'Erreur réseau. Réessaie.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: { email, code: code.toUpperCase(), newPassword },
      });
      toast('Mot de passe modifié — connecte-toi avec le nouveau.', 'success');
      close();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (RESET_ERRORS[err.code] ?? err.message)
          : 'Erreur réseau. Réessaie.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          onClick={close}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center px-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-sm shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Icon i={step === 'reset' ? 'lock' : 'mail'} size={18} className="text-primary" />
              </div>
              <div
                id="forgot-password-title"
                className="font-headings font-bold text-base text-foreground"
              >
                {step === 'email' && 'Mot de passe oublié'}
                {step === 'sent' && 'Vérifie ton email'}
                {step === 'reset' && 'Nouveau mot de passe'}
              </div>
            </div>

            {step === 'email' && (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  Entre l&rsquo;email lié à ton compte — on t&rsquo;envoie un code pour
                  réinitialiser ton mot de passe.
                </div>
                <form onSubmit={submitEmail} className="flex flex-col gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ton@email.com"
                    autoFocus
                    required
                    className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
                  />
                  {error && <div className="text-sm text-danger">{error}</div>}
                  <button
                    type="submit"
                    disabled={submitting || email.length === 0}
                    className="bg-primary text-primary-foreground font-headings font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
                  >
                    {submitting ? 'Envoi…' : 'Envoyer le code'}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={close}
                  className="text-xs text-muted-foreground font-bold mt-4"
                >
                  Annuler
                </button>
              </>
            )}

            {step === 'sent' && (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  Si un compte existe pour <strong className="text-foreground">{email}</strong>, un
                  code à 8 caractères vient d&rsquo;être envoyé par email. Consulte ta boîte de
                  réception (et les spams), puis reviens ici pour choisir un nouveau mot de passe.
                </div>
                <button
                  type="button"
                  onClick={() => setStep('reset')}
                  className="w-full bg-primary text-primary-foreground font-headings font-bold text-sm py-2.5 rounded-lg"
                >
                  J&rsquo;ai reçu le code
                </button>
                <div className="flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-xs text-primary font-bold"
                  >
                    Mauvais email ?
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="text-xs text-muted-foreground font-bold"
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}

            {step === 'reset' && (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  Saisis le code reçu par email et choisis un nouveau mot de passe.
                </div>
                <form onSubmit={submitReset} className="flex flex-col gap-3">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Code à 8 caractères"
                    autoFocus
                    className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nouveau mot de passe"
                    autoComplete="new-password"
                    className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
                  />
                  {error && <div className="text-sm text-danger">{error}</div>}
                  <button
                    type="submit"
                    disabled={submitting || code.length === 0 || newPassword.length === 0}
                    className="bg-primary text-primary-foreground font-headings font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
                  >
                    {submitting ? 'Validation…' : 'Réinitialiser le mot de passe'}
                  </button>
                </form>
                <div className="flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => setStep('sent')}
                    className="text-xs text-muted-foreground font-bold"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="text-xs text-muted-foreground font-bold"
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
