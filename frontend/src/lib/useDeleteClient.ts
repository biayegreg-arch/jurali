'use client';

// Debtor-list "Supprimer" action (desktop table + mobile card) — shared by
// `/clients` and `/dashboard` since both mount the same row components.
// Holds which client is pending confirmation so each page only has to
// render one <ConfirmDialog> wired to this hook's return value.
import { useState } from 'react';
import { api, ApiError } from './api';
import { invalidateAllCache } from './useApi';
import { useAsyncAction } from './useAsyncAction';

export function useDeleteClient(refresh: () => Promise<void>, onError?: (message: string) => void) {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const { pending, run } = useAsyncAction();

  function requestDelete(id: string, name: string) {
    setTarget({ id, name });
  }

  function cancel() {
    setTarget(null);
  }

  async function confirmDelete() {
    if (!target) return;
    await run(
      async () => {
        await api(`/api/clients/${target.id}`, { method: 'DELETE' });
        invalidateAllCache();
        await refresh();
        setTarget(null);
      },
      (err) => {
        const message = err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.';
        onError?.(message);
        return message;
      },
    );
  }

  return { target, pending, requestDelete, cancel, confirmDelete };
}
