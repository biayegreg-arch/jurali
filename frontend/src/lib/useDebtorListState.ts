'use client';

// Shared debtor-list data/filter state — used by both `/clients` (mobile
// card list + desktop table) and `/dashboard`'s desktop sidebar+table view
// (see .planning/banani/dashboard.md § Desktop sidebar + table). Extracted
// once both pages needed the identical search/sort/overdue/month state and
// the same `/api/clients` fetch, rather than duplicating it a second time.
import { useEffect, useMemo, useState } from 'react';
import { useApi } from './useApi';
import { formatMonthParam } from './server/jurali/month-range';
import type { ClientSummary } from './server/jurali/clients';

const SEARCH_DEBOUNCE_MS = 300;

function currentMonthParam(): string {
  const now = new Date();
  return formatMonthParam(now.getFullYear(), now.getMonth());
}

export function useDebtorListState(opts: { skip: boolean; initialOverdueOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<'amount' | 'activity'>('activity');
  const [overdueOnly, setOverdueOnly] = useState(opts.initialOverdueOnly ?? false);
  const [monthActive, setMonthActive] = useState(false);
  const [month, setMonth] = useState(currentMonthParam);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const listPath = `/api/clients?sort=${sort}&order=desc${
    debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ''
  }${monthActive ? `&month=${month}` : ''}`;
  const {
    data: clients,
    loading: clientsLoading,
    refresh: refreshClients,
  } = useApi<{ items: ClientSummary[] }>(listPath, {
    skip: opts.skip,
  });

  const items = useMemo(
    () => (clients?.items ?? []).filter((c) => !overdueOnly || c.isOverdue),
    [clients, overdueOnly],
  );

  function resetToAll() {
    setMonthActive(false);
    setOverdueOnly(false);
  }

  return {
    query,
    setQuery,
    debouncedQuery,
    sort,
    setSort,
    overdueOnly,
    setOverdueOnly,
    monthActive,
    setMonthActive,
    month,
    setMonth,
    items,
    clientsLoading,
    resetToAll,
    refreshClients,
  };
}
