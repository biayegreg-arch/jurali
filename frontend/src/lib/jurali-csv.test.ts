import { describe, expect, it } from 'vitest';
import { buildDebtsCsv, type ExportRow } from './jurali-csv';

function row(over: Partial<ExportRow> = {}): ExportRow {
  return {
    clientName: 'Fatou',
    phone: '+221771234567',
    type: 'DEBT',
    amountFcfa: 12_500,
    note: 'Riz 5kg',
    createdAt: '2026-08-01T00:00:00Z',
    ...over,
  };
}

describe('buildDebtsCsv', () => {
  it('starts with the French header row', () => {
    const csv = buildDebtsCsv([]);
    expect(csv).toBe('Client,Téléphone,Type,Montant (FCFA),Détail,Date');
  });

  it('renders a DEBT row with all fields', () => {
    const csv = buildDebtsCsv([row()]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('Fatou,+221771234567,Dette,12500,Riz 5kg,1 août 2026');
  });

  it('renders a PAYMENT row', () => {
    const csv = buildDebtsCsv([row({ type: 'PAYMENT', note: null })]);
    expect(csv.split('\n')[1]).toContain('Paiement');
  });

  it('quotes a field containing a comma', () => {
    const csv = buildDebtsCsv([row({ note: 'Riz, huile, sucre' })]);
    expect(csv.split('\n')[1]).toContain('"Riz, huile, sucre"');
  });

  it('escapes embedded double quotes', () => {
    const csv = buildDebtsCsv([row({ note: 'Le "meilleur" riz' })]);
    expect(csv.split('\n')[1]).toContain('"Le ""meilleur"" riz"');
  });

  it('neutralizes a formula-injection payload in note/client name', () => {
    const csv = buildDebtsCsv([row({ clientName: '=cmd|"/c calc"!A1', note: '+SUM(1+1)' })]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[0]).toBe('"\'=cmd|""/c calc""!A1"');
    expect(fields[4]).toBe("'+SUM(1+1)");
  });

  it('renders an empty string for a missing phone/note', () => {
    const csv = buildDebtsCsv([row({ phone: null, note: null })]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[1]).toBe('');
  });

  it('renders one line per row, in the given order', () => {
    const csv = buildDebtsCsv([row({ clientName: 'Fatou' }), row({ clientName: 'Moussa' })]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Fatou');
    expect(lines[2]).toContain('Moussa');
  });
});
