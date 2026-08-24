import { describe, expect, it } from 'vitest';
import { buildPdfFilename, buildClientHistoryPdf } from './jurali-pdf';

describe('buildPdfFilename', () => {
  it('slugifies the client first name into a lowercase, hyphenated filename', () => {
    expect(buildPdfFilename('Awa Ndiaye')).toBe('releve-awa-ndiaye.pdf');
  });

  it('strips accents so the filename stays ASCII-safe', () => {
    expect(buildPdfFilename('Chérif Bâ')).toBe('releve-cherif-ba.pdf');
  });

  it('collapses repeated whitespace', () => {
    expect(buildPdfFilename('  Fatou   Diop  ')).toBe('releve-fatou-diop.pdf');
  });
});

describe('buildClientHistoryPdf', () => {
  const client = {
    firstName: 'Awa',
    phone: '+221771234567',
    balanceFcfa: 7_500,
    transactions: [
      {
        type: 'DEBT' as const,
        amountFcfa: 12_500,
        note: 'Riz 5kg',
        createdAt: '2026-08-01T10:00:00Z',
      },
      {
        type: 'PAYMENT' as const,
        amountFcfa: 5_000,
        note: null,
        createdAt: '2026-08-10T10:00:00Z',
      },
    ],
  };

  it('builds a single-page PDF without throwing', () => {
    const doc = buildClientHistoryPdf(client, 'Boutique Awa');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
  });

  it('handles a client with no transaction history', () => {
    const doc = buildClientHistoryPdf({ ...client, transactions: [] }, 'Boutique Awa');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('handles a null shop name', () => {
    const doc = buildClientHistoryPdf(client, null);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('spills onto a second page for a long history', () => {
    const manyTransactions = Array.from({ length: 60 }, (_, i) => ({
      type: 'DEBT' as const,
      amountFcfa: 1_000,
      note: `Article ${i}`,
      createdAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    const doc = buildClientHistoryPdf(
      { ...client, transactions: manyTransactions },
      'Boutique Awa',
    );
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
