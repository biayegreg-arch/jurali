'use client';

// Nouvelle dette — PRD 3.3 / US-01. Reproduces Banani's NewDebtForm.jsx +
// NewDebtForm2.jsx (a single screen with two data states, not a wizard —
// see .planning/banani/new-debt.md for the correction vs. the original
// 2-step assumption, and the confirmed decisions).
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { ClientPicker, type PickedClient } from '@/components/jurali/ClientPicker';
import { AmountField } from '@/components/jurali/AmountField';

export default function NewDebtPage() {
  return (
    <Suspense fallback={null}>
      <NewDebtPageContent />
    </Suspense>
  );
}

function NewDebtPageContent() {
  const user = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const [client, setClient] = useState<PickedClient | null>(
    params.get('clientId') ? { id: params.get('clientId')!, firstName: '' } : null,
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function submit() {
    if (!client || !amount || amount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/transactions', {
        method: 'POST',
        body: {
          clientId: client.id,
          type: 'DEBT',
          amountFcfa: amount,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      toast('Dette enregistrée', 'success');
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!client && !!amount && amount > 0 && !submitting;

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col">
      <div className="bg-primary px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
          >
            <Icon i="chevron-left" size={20} className="text-primary-foreground" />
          </Link>
          <div className="font-headings font-bold text-lg text-primary-foreground">
            Nouvelle dette
          </div>
        </div>
        <div className="text-xs text-secondary font-body ml-11 opacity-90">
          Remplis les infos rapidement
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 flex-1 flex flex-col max-w-lg w-full mx-auto">
        <ClientPicker value={client} onChange={setClient} />

        <AmountField label="Montant dû" value={amount} onChange={setAmount} />

        <div className="mb-6">
          <div className="text-xs font-headings uppercase tracking-wide text-foreground mb-2">
            Achetés
          </div>
          <div className="bg-input border border-border rounded-xl px-3 py-3 min-h-12 flex items-center">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Décris les articles... (optionnel)"
              className="flex-1 bg-transparent text-base text-foreground placeholder-muted-foreground outline-none"
            />
          </div>
        </div>

        {error && <div className="mb-4 text-sm text-danger">{error}</div>}

        <div className="flex-1" />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl disabled:opacity-50"
          >
            <Icon i="check" size={20} />
            {submitting ? 'Enregistrement…' : 'Enregistrer la dette'}
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-base py-3 rounded-xl"
          >
            <Icon i="x" size={18} />
            Annuler
          </Link>
        </div>
      </div>
    </div>
  );
}
