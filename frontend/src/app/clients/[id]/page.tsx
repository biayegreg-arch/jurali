'use client';

// Fiche client — PRD 3.6 / US-04. Reproduces Banani's FicheClient.jsx; see
// .planning/banani/fiche-client.md for translation notes and decisions.
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { Icon } from '@/components/jurali/Icon';
import { DebtHistoryRow } from '@/components/jurali/DebtHistoryRow';
import { formatDateFr } from '@/lib/jurali-format';
import { formatPrice } from '@/lib/utils';
import { computeDebtStatuses, type DebtTransaction } from '@/lib/server/jurali/balance';

interface ClientTransaction {
  id: string;
  type: 'DEBT' | 'PAYMENT';
  amountFcfa: number;
  note: string | null;
  createdAt: string;
}

interface ClientDetail {
  id: string;
  firstName: string;
  phone: string | null;
  createdAt: string;
  balanceFcfa: number;
  isOverdue: boolean;
  transactions: ClientTransaction[];
}

export default function ClientFichePage() {
  const user = useUser();
  const params = useParams<{ id: string }>();
  const { data: client, loading, error } = useApi<ClientDetail>(`/api/clients/${params.id}`);

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background font-body flex flex-col">
      <div className="bg-primary px-4 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
          >
            <Icon i="chevron-left" size={20} className="text-primary-foreground" />
          </Link>
          <div>
            <div className="font-headings font-bold text-lg text-primary-foreground">
              Fiche client
            </div>
            <div className="text-xs text-secondary">Historique complet des dettes</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">Chargement…</div>
      ) : error || !client ? (
        <div className="px-4 py-8 flex flex-col items-center gap-3 text-center">
          <div className="text-sm text-muted-foreground">Client introuvable.</div>
          <Link href="/clients" className="text-sm text-primary font-bold">
            Retour à la liste
          </Link>
        </div>
      ) : (
        <ClientFicheBody client={client} />
      )}
    </div>
  );
}

function ClientFicheBody({ client }: { client: ClientDetail }) {
  const debtStatuses = computeDebtStatuses(
    client.transactions
      .filter((t): t is ClientTransaction & { type: 'DEBT' } => t.type === 'DEBT')
      .map(
        (t): DebtTransaction => ({
          id: t.id,
          type: 'DEBT',
          amountFcfa: t.amountFcfa,
          createdAt: new Date(t.createdAt),
        }),
      ),
  );

  const debtCount = client.transactions.filter((t) => t.type === 'DEBT').length;
  const overdueCount = [...debtStatuses.values()].filter((s) => s === 'OVERDUE').length;
  const totalPaidFcfa = client.transactions
    .filter((t) => t.type === 'PAYMENT')
    .reduce((sum, t) => sum + t.amountFcfa, 0);

  const history = [...client.transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="px-4 pt-5 pb-8 flex flex-col gap-5 max-w-lg w-full mx-auto">
      {/* Identity card */}
      <div className="bg-background border border-border rounded-xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
            <span className="font-headings font-bold text-xl text-secondary-foreground">
              {client.firstName.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-headings font-bold text-lg text-foreground truncate">
              {client.firstName}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Client depuis {formatDateFr(client.createdAt)}
            </div>
          </div>
        </div>
        {client.phone && (
          <div className="flex items-center gap-3">
            <Icon i="phone" size={16} className="text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground">{client.phone}</span>
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Total dû"
          value={formatPrice(client.balanceFcfa)}
          danger={client.isOverdue}
        />
        <StatTile label="Total payé" value={formatPrice(totalPaidFcfa)} />
        <StatTile label="Nb dettes" value={String(debtCount)} sub="au total" />
        <StatTile
          label="En retard"
          value={String(overdueCount)}
          sub="à régler"
          danger={overdueCount > 0}
        />
      </div>

      {/* Reminder card — Phase 8 not built yet, shown inert */}
      <div className="bg-secondary border border-border rounded-xl px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon i="clock" size={16} className="text-primary" />
          <span className="font-headings font-bold text-sm text-foreground">Rappel manuel</span>
        </div>
        <div className="text-sm text-muted-foreground">Disponible bientôt</div>
        <button
          type="button"
          disabled
          className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-headings font-bold text-xs py-2.5 rounded-lg opacity-50 cursor-not-allowed"
        >
          <Icon i="message-circle" size={14} />
          Envoyer WhatsApp
        </button>
      </div>

      {/* History */}
      <div className="flex flex-col gap-2">
        <div className="font-headings font-bold text-sm text-foreground uppercase tracking-wide">
          Historique
        </div>
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          {history.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Aucune dette enregistrée pour ce client.
            </div>
          ) : (
            history.map((t, i) => (
              <DebtHistoryRow
                key={t.id}
                note={t.note ?? (t.type === 'DEBT' ? 'Dette' : 'Paiement reçu')}
                amount={formatPrice(t.amountFcfa)}
                dateLabel={formatDateFr(t.createdAt)}
                status={t.type === 'PAYMENT' ? 'PAYMENT' : (debtStatuses.get(t.id) ?? 'UNPAID')}
                isFirst={i === 0}
              />
            ))
          )}
        </div>
      </div>

      <Link
        href={`/debts/new?clientId=${client.id}`}
        className="flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base py-4 rounded-xl"
      >
        <Icon i="plus" size={20} />
        Ajouter une dette
      </Link>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  danger = false,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-background border border-border rounded-xl px-4 py-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div
        className={`font-headings font-bold text-xl ${danger ? 'text-danger' : 'text-foreground'}`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub ?? 'FCFA'}</div>
    </div>
  );
}
