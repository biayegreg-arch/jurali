'use client';

// Shown on every authenticated page (mounted from the (shell) layout) while
// user.pendingEmail is set — a phone-signup account that added an email
// still gets a session immediately (see api/auth/phone-signup/route.ts's own
// comment on why), but until now nothing surfaced the code-entry step that
// already existed in Réglages > Sécurité, so the email just sat unconfirmed
// forever. Mirrors that same form (verify-pending-email / resend-pending-email)
// in a dismissible popup instead. "Plus tard" only dismisses for this mount —
// it reappears on the next connection (confirmed with the user) since it's
// re-rendered fresh whenever the shell layout mounts.
import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/jurali/Icon';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

export interface PendingEmailModalProps {
  email: string;
  onVerified: () => void | Promise<void>;
}

export function PendingEmailModal({ email, onVerified }: PendingEmailModalProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      await api('/api/auth/verify-pending-email', { method: 'POST', body: { code } });
      toast('Email vérifié.', 'success');
      setOpen(false);
      await onVerified();
    } catch (err) {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {
          VERIFICATION_CODE_INVALID: 'Code invalide.',
          VERIFICATION_CODE_EXPIRED: 'Code expiré — demande-en un nouveau.',
          EMAIL_ALREADY_REGISTERED: 'Cet email est déjà utilisé par un autre compte.',
          NO_PENDING_EMAIL: 'Aucun email en attente.',
        };
        setError(map[err.code] ?? err.message);
      } else {
        setError('Erreur réseau. Réessaie.');
      }
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    setResending(true);
    try {
      await api('/api/auth/resend-pending-email', { method: 'POST' });
      toast('Code renvoyé.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.', 'error');
    } finally {
      setResending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          onClick={() => setOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center px-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-email-title"
            aria-describedby="pending-email-message"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.2 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-sm shadow-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Icon i="mail" size={18} className="text-primary" />
              </div>
              <div
                id="pending-email-title"
                className="font-headings font-bold text-base text-foreground"
              >
                Confirme ton email
              </div>
            </div>
            <div id="pending-email-message" className="text-sm text-muted-foreground mb-4">
              Un code à 8 caractères a été envoyé à{' '}
              <strong className="text-foreground">{email}</strong>. Saisis-le pour confirmer ton
              adresse.
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Code à 8 caractères"
                autoFocus
                className="bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
              />
              {error && <div className="text-sm text-danger">{error}</div>}
              <button
                type="submit"
                disabled={verifying || code.length === 0}
                className="bg-primary text-primary-foreground font-headings font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
              >
                {verifying ? 'Vérification…' : 'Valider'}
              </button>
            </form>
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={onResend}
                disabled={resending}
                className="text-xs text-primary font-bold disabled:opacity-60"
              >
                {resending ? 'Envoi…' : 'Renvoyer le code'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground font-bold"
              >
                Plus tard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
