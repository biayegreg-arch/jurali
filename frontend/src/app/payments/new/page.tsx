'use client';

// Paiement reçu — PRD 3.4 / US-03. No Banani screen matches this flow (the
// 2 fetched "PaymentReceipt" screens are multi-client batch-collection
// receipts, not a single-payment entry form) — built fresh, reusing
// ClientPicker/AmountField's visual language and PaymentReceipt.jsx's
// receipt-card aesthetic for the confirmation. See
// .planning/banani/payment-receive.md for the full reasoning + confirmed
// decisions.
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { invalidateAllCache } from '@/lib/useApi';
import { formatPrice } from '@/lib/utils';
import { Icon } from '@/components/jurali/Icon';
import { ClientPicker, type PickedClient } from '@/components/jurali/ClientPicker';
import { AmountField } from '@/components/jurali/AmountField';

interface Receipt {
  clientName: string;
  amountFcfa: number;
  date: string;
}

export default function NewPaymentPage() {
  const user = useUser();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  if (!user) return null;

  function selectClient(picked: PickedClient) {
    setClient(picked);
    setAmount(picked.balanceFcfa && picked.balanceFcfa > 0 ? picked.balanceFcfa : null);
    setError(null);
  }

  async function submit() {
    if (!client || !amount || amount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/transactions', {
        method: 'POST',
        body: { clientId: client.id, type: 'PAYMENT', amountFcfa: amount },
      });
      invalidateAllCache();
      setReceipt({
        clientName: client.firstName,
        amountFcfa: amount,
        date: new Date().toLocaleString('fr-FR'),
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PAYMENT_EXCEEDS_BALANCE') {
        setError('Ce montant dépasse le solde du client.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessaie.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <div className="min-h-dvh bg-background font-body flex flex-col">
        <div className="bg-primary px-4 pt-10 pb-5">
          <div className="font-headings font-bold text-lg text-primary-foreground">
            Reçu de paiement
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-6">
          <div className="w-full bg-background border-2 border-foreground rounded-2xl px-6 py-8 max-w-sm">
            <div className="text-center mb-6 pb-6 border-b-2 border-foreground">
              <div className="font-headings font-bold text-2xl text-foreground mb-1">JURALI</div>
              <div className="text-xs text-muted-foreground">Gestion des dettes simplifiée</div>
            </div>
            <div className="mb-6 text-sm">
              <div className="text-xs uppercase text-muted-foreground font-body mb-2">Client</div>
              <div className="font-headings font-semibold text-foreground">
                {receipt.clientName}
              </div>
              <div className="text-xs text-muted-foreground">{receipt.date}</div>
            </div>
            <div className="border-t-2 border-foreground my-4" />
            <div className="mb-2">
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase text-muted-foreground font-body">
                  Montant reçu
                </span>
                <span className="font-headings font-bold text-2xl text-primary">
                  {formatPrice(receipt.amountFcfa)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">FCFA</div>
            </div>
            <div className="border-t-2 border-foreground my-4" />
            <div className="text-center text-xs text-muted-foreground">
              <p>Merci pour votre confiance — Jurali</p>
            </div>
          </div>
        </div>
        <div className="px-4 pb-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              setClient(null);
              setAmount(null);
            }}
            className="flex items-center justify-center gap-2 bg-surface border border-border text-foreground font-headings font-bold text-base py-3 rounded-xl"
          >
            Nouveau paiement
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-headings font-bold text-base py-4 rounded-xl"
          >
            Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  const canSubmit = !!client && !!amount && amount > 0 && !submitting;

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col">
      <div className="bg-primary px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/dashboard"
            className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
          >
            <Icon i="chevron-left" size={20} className="text-primary-foreground" />
          </Link>
          <div className="font-headings font-bold text-lg text-primary-foreground">
            Paiement reçu
          </div>
        </div>
        <div className="text-xs text-secondary font-body ml-11 opacity-90">
          Enregistre un remboursement
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 flex-1 flex flex-col max-w-lg w-full mx-auto">
        <ClientPicker
          value={client}
          onChange={selectClient}
          helperText="Le montant se pré-remplit avec le solde dû"
        />

        <AmountField label="Montant remboursé" value={amount} onChange={setAmount} />

        {client && client.balanceFcfa !== undefined && (
          <div className="mb-4 text-xs text-muted-foreground">
            Solde actuel de {client.firstName} : {formatPrice(client.balanceFcfa)} FCFA
          </div>
        )}

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
            {submitting ? 'Enregistrement…' : 'Enregistrer le paiement'}
          </button>
          <Link
            href="/dashboard"
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
