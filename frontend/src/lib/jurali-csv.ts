// Client-side CSV export — Phase 9 (Parametres.jsx "Exporter toutes les
// dettes"). Runs entirely in the browser, same "no server-side file
// generation" reasoning as jurali-pdf.ts.
import { formatDateFr } from './jurali-format';

export interface ExportRow {
  clientName: string;
  phone: string | null;
  type: 'DEBT' | 'PAYMENT';
  amountFcfa: number;
  note: string | null;
  createdAt: string;
}

function quoteCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Client name / note are shopkeeper-entered free text that flows straight
// into a CSV Excel/Sheets may open — a value starting with =/+/-/@ would be
// interpreted as a formula there (CSV injection). Prefixing a leading
// apostrophe neutralizes that while staying invisible in normal spreadsheet
// display. Phone is NOT run through this: it's a server-validated E.164
// value (always `+<digits>`, never free text), so treating its leading `+`
// as a formula risk would corrupt every legitimate phone number instead.
function escapeCsvFreeText(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return quoteCsvField(safe);
}

export function buildDebtsCsv(rows: ExportRow[]): string {
  const header = ['Client', 'Téléphone', 'Type', 'Montant (FCFA)', 'Détail', 'Date'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvFreeText(row.clientName),
        quoteCsvField(row.phone ?? ''),
        row.type === 'DEBT' ? 'Dette' : 'Paiement',
        String(row.amountFcfa),
        escapeCsvFreeText(row.note ?? ''),
        quoteCsvField(formatDateFr(row.createdAt)),
      ].join(','),
    );
  }
  return lines.join('\n');
}

export function downloadDebtsCsv(rows: ExportRow[]): void {
  const csv = buildDebtsCsv(rows);
  // BOM so Excel opens accented characters (client/note) as UTF-8, not Latin-1.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jurali-dettes.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
