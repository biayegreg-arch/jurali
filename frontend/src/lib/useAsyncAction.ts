'use client';

// Shared submit-button bookkeeping (Phase 9 fiche client re-fetch) — every
// "tap a button, call the API, show an error inline" action on that page
// (manual WhatsApp reminder, record a payment, mark overdue debts paid) was
// hand-rolling the same
// setPending(true)/setError(null)/try{...}catch{setError}finally{setPending(false)}
// shape. One hook means a future change to error handling (a toast, a
// retry) only has to be made once.
import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not the `pending` state, guards re-entrancy: two synchronous
  // clicks (double-click/double-tap) both fire before React flushes the
  // first setPending(true), so both would read the same stale
  // `pending === false` from their render's closure and both proceed.
  const pendingRef = useRef(false);

  async function run(
    action: () => Promise<void>,
    mapError?: (err: unknown) => string,
  ): Promise<void> {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(
        mapError
          ? mapError(err)
          : err instanceof ApiError
            ? err.message
            : 'Erreur réseau. Réessaie.',
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return { pending, error, run };
}
