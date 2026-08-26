'use client';

// Client search + select + create-on-the-fly (US-05), shared by the
// Nouvelle dette and Paiement reçu forms. See .planning/banani/new-debt.md.
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { invalidateAllCache } from '@/lib/useApi';
import { Icon } from './Icon';

export interface PickedClient {
  id: string;
  firstName: string;
  /** Current balance, when known (from a search match). Used by the
   * Paiement reçu screen to pre-fill the amount field. */
  balanceFcfa?: number;
}

interface ClientMatch {
  id: string;
  firstName: string;
  phone: string | null;
  balanceFcfa: number;
}

export interface ClientPickerProps {
  value: PickedClient | null;
  onChange: (client: PickedClient) => void;
  helperText?: string;
  /** Forwarded to the underlying `<input>` — lets a sibling control (e.g.
   * the desktop "Créer client" shortcut button) focus this field by id
   * instead of duplicating the search/create UX. */
  inputId?: string;
}

const SEARCH_DEBOUNCE_MS = 250;

export function ClientPicker({
  value,
  onChange,
  helperText = 'Sélectionner un client existant',
  inputId,
}: ClientPickerProps) {
  const [query, setQuery] = useState(value?.firstName ?? '');
  const [matches, setMatches] = useState<ClientMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keeps the input synced when `value` is set/updated from outside (e.g. a
  // caller preloads a client by id before its name has loaded — see
  // debts/new's `?clientId=` flow). `select()`/`createAndSelect()` already
  // set `query` directly, so this only fires for genuinely external changes.
  useEffect(() => {
    setQuery(value?.firstName ?? '');
  }, [value?.id, value?.firstName]);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setMatches([]);
      return;
    }
    const id = setTimeout(() => {
      const currentRequest = ++requestIdRef.current;
      api<{ items: ClientMatch[] }>(`/api/clients?q=${encodeURIComponent(query)}&limit=8`)
        .then((res) => {
          if (requestIdRef.current === currentRequest) setMatches(res.items);
        })
        .catch(() => {
          if (requestIdRef.current === currentRequest) setMatches([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, open]);

  function select(client: PickedClient) {
    onChange(client);
    setQuery(client.firstName);
    setOpen(false);
  }

  async function createAndSelect() {
    setCreating(true);
    setLimitReached(false);
    try {
      const created = await api<{ id: string; firstName: string }>('/api/clients', {
        method: 'POST',
        body: { firstName: query.trim() },
      });
      invalidateAllCache();
      select(created);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CLIENT_LIMIT_REACHED') {
        setLimitReached(true);
      }
    } finally {
      setCreating(false);
    }
  }

  const exactMatch = matches.some((m) => m.firstName.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="mb-5 relative" ref={containerRef}>
      <div className="text-xs font-headings uppercase tracking-wide text-foreground mb-2">
        Client
      </div>
      <div className="flex items-center gap-2 bg-input border border-border rounded-xl px-3 py-3">
        <Icon i="search" size={16} className="text-muted-foreground flex-shrink-0" />
        <input
          id={inputId}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Chercher ou sélectionner..."
          className="flex-1 bg-transparent text-base text-foreground placeholder-muted-foreground outline-none"
        />
        {value && !open && (
          <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <span className="font-headings font-bold text-sm text-secondary-foreground">
              {value.firstName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      {!open && <div className="text-xs text-muted-foreground mt-2">{helperText}</div>}

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-background border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => select(m)}
              className="w-full text-left px-3 py-2.5 text-base text-foreground hover:bg-muted border-b border-border last:border-b-0"
            >
              {m.firstName}
              {m.phone ? (
                <span className="text-xs text-muted-foreground ml-2">{m.phone}</span>
              ) : null}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={createAndSelect}
              disabled={creating}
              className="w-full text-left px-3 py-2.5 text-base text-primary font-semibold disabled:opacity-50"
            >
              {creating ? 'Création…' : `Créer « ${query.trim()} »`}
            </button>
          )}
          {matches.length === 0 && !query.trim() && (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">
              Tape un nom pour chercher
            </div>
          )}
        </div>
      )}

      {limitReached && (
        <div className="text-xs text-danger mt-2">
          Limite de 10 clients gratuits atteinte —{' '}
          <a href="/premium" className="underline font-semibold">
            passer à Premium
          </a>
          .
        </div>
      )}
    </div>
  );
}
