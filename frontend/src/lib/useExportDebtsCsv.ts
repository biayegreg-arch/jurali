'use client';

// Shared CSV-export logic (Phase 9) — used by /settings' "Exporter toutes
// les dettes" and /debts/overdue's "Exporter" button. Each page renders its
// own button markup (the two screens use different visual treatments) but
// both call the same GET /api/clients/export + downloadDebtsCsv flow, so
// the logic lives in one hook rather than two copies that could drift.
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { downloadDebtsCsv, type ExportRow } from '@/lib/jurali-csv';

export function useExportDebtsCsv() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const res = await api<{ items: ExportRow[] }>('/api/clients/export');
      downloadDebtsCsv(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.');
    } finally {
      setExporting(false);
    }
  }

  return { exporting, error, exportCsv };
}
