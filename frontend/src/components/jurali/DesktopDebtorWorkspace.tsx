import { Icon } from './Icon';
import { NotificationBell } from './TopBar';
import { DebtorTableRow } from './DebtorTableRow';
import { MonthPicker } from './MonthPicker';
import { toDebtorRowProps } from '@/lib/jurali-format';
import { formatMonthLabelFr, parseMonthParam } from '@/lib/server/jurali/month-range';
import type { ClientSummary } from '@/lib/server/jurali/clients';

// The right-hand content of Banani's "Dashboard Desktop" screen (title +
// bell, search/filter row, full debtor table) — extracted so `/clients`
// and `/dashboard` can both mount the identical lg+ workspace instead of
// duplicating it (see .planning/banani/dashboard.md § Desktop sidebar +
// table). Always paired with `<DesktopSidebar>` in the parent page.
export interface DesktopDebtorWorkspaceProps {
  query: string;
  onQueryChange: (value: string) => void;
  debouncedQuery: string;
  monthActive: boolean;
  onSelectAllTime: () => void;
  onSelectMonth: () => void;
  month: string;
  onMonthChange: (month: string) => void;
  overdueOnly: boolean;
  onToggleOverdueOnly: () => void;
  items: ClientSummary[];
  clientsLoading: boolean;
  notificationCount: number;
}

export function DesktopDebtorWorkspace({
  query,
  onQueryChange,
  debouncedQuery,
  monthActive,
  onSelectAllTime,
  onSelectMonth,
  month,
  onMonthChange,
  overdueOnly,
  onToggleOverdueOnly,
  items,
  clientsLoading,
  notificationCount,
}: DesktopDebtorWorkspaceProps) {
  return (
    <div className="hidden lg:flex flex-1 flex-col">
      <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-border">
        <div>
          <div className="font-headings font-bold text-2xl text-foreground">Tous les débiteurs</div>
          {/* Only shown when a month is actually selected — unlike
              Banani's mock (a hardcoded "Janvier 2024"), showing a date
              here with no active filter would misleadingly imply the
              list is scoped to a month when it isn't. */}
          {monthActive && (
            <div className="text-sm text-muted-foreground mt-0.5">
              {formatMonthLabelFr(parseMonthParam(month).year, parseMonthParam(month).month)}
            </div>
          )}
        </div>
        <NotificationBell count={notificationCount} />
      </div>

      <div className="px-8 pt-5 pb-4 flex items-center gap-4">
        <div className="flex items-center gap-2 bg-input border border-border rounded-xl px-4 py-2.5 flex-1 max-w-md">
          <Icon i="search" size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Chercher un client..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onSelectAllTime}
            className={`text-sm font-bold px-4 py-2 rounded-lg ${
              !monthActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface border border-border text-foreground'
            }`}
          >
            Tous
          </button>
          <button
            type="button"
            onClick={onSelectMonth}
            className={`text-sm px-4 py-2 rounded-lg ${
              monthActive
                ? 'bg-primary text-primary-foreground font-bold'
                : 'bg-surface border border-border text-foreground'
            }`}
          >
            Ce mois
          </button>
          {monthActive && <MonthPicker month={month} onChange={onMonthChange} />}
          <button
            type="button"
            onClick={onToggleOverdueOnly}
            className={`text-sm px-4 py-2 rounded-lg ${
              overdueOnly
                ? 'bg-primary text-primary-foreground font-bold'
                : 'bg-surface border border-border text-foreground'
            }`}
          >
            En retard
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-8 pb-3">
        <div className="font-headings font-bold text-sm text-foreground uppercase tracking-wide">
          Débiteurs
        </div>
        <span className="text-sm text-muted-foreground">
          {clientsLoading
            ? ''
            : `${items.length} résultat${items.length === 1 ? '' : 's'}${
                monthActive
                  ? ` — ${formatMonthLabelFr(parseMonthParam(month).year, parseMonthParam(month).month)}`
                  : ''
              }`}
        </span>
      </div>

      <div className="px-8 pb-8 flex-1">
        <div className="bg-background border border-border rounded-xl overflow-hidden h-full">
          <div className="flex items-center px-6 py-4 bg-muted border-b border-border font-headings font-bold text-sm text-foreground uppercase tracking-wide">
            <div className="w-12">Client</div>
            <div className="flex-1 pl-2">Produit</div>
            <div className="w-32 text-right">Montant</div>
            <div className="w-24 text-right">Ancienneté</div>
            <div className="w-24 text-right">Statut</div>
          </div>

          <div className="divide-y divide-border">
            {clientsLoading ? (
              <div className="px-6 py-6 text-sm text-muted-foreground">Chargement…</div>
            ) : items.length === 0 && debouncedQuery ? (
              <div className="px-6 py-6 text-sm text-muted-foreground">
                Aucun client ne correspond à « {debouncedQuery} ».
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-6 text-sm text-muted-foreground">
                Aucun client pour l&rsquo;instant — ajoute ton premier client en enregistrant une
                dette.
              </div>
            ) : (
              items.map((c, i) => <DebtorTableRow key={c.id} {...toDebtorRowProps(c, i)} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
