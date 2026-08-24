// Client-side PDF export — Phase 9 (fiche client "Exporter PDF", deferred
// from Phase 5, see .planning/banani/fiche-client.md). Runs entirely in the
// browser via jsPDF: no server route, no Puppeteer/headless-browser
// rendering — fits this app's Vercel-serverless-first constraint (no
// long-running server compute) and avoids a 502-on-cold-start risk for a
// feature that's just formatting already-fetched data.
import { jsPDF } from 'jspdf';
import { formatPrice } from './utils';
import { formatDateFr } from './jurali-format';

export interface PdfTransaction {
  type: 'DEBT' | 'PAYMENT';
  amountFcfa: number;
  note: string | null;
  createdAt: string;
}

export interface PdfClientData {
  firstName: string;
  phone: string | null;
  balanceFcfa: number;
  transactions: PdfTransaction[];
}

export function buildPdfFilename(firstName: string): string {
  const slug = firstName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  return `releve-${slug}.pdf`;
}

const PAGE_MARGIN = 15;
const LINE_HEIGHT = 7;

export function buildClientHistoryPdf(client: PdfClientData, shopName: string | null): jsPDF {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = PAGE_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(shopName?.trim() || 'Jurali', PAGE_MARGIN, y);
  y += LINE_HEIGHT + 2;

  doc.setFontSize(12);
  doc.text(`Relevé de compte — ${client.firstName}`, PAGE_MARGIN, y);
  y += LINE_HEIGHT;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (client.phone) {
    doc.text(`Téléphone : ${client.phone}`, PAGE_MARGIN, y);
    y += LINE_HEIGHT;
  }
  doc.text(`Généré le ${formatDateFr(new Date().toISOString())}`, PAGE_MARGIN, y);
  y += LINE_HEIGHT + 2;

  doc.setFont('helvetica', 'bold');
  doc.text(`Solde dû : ${formatPrice(client.balanceFcfa)} FCFA`, PAGE_MARGIN, y);
  y += LINE_HEIGHT + 4;

  doc.setFontSize(9);
  doc.text('Date', PAGE_MARGIN, y);
  doc.text('Détail', PAGE_MARGIN + 30, y);
  doc.text('Montant', PAGE_MARGIN + 140, y);
  y += 2;
  doc.line(PAGE_MARGIN, y, 210 - PAGE_MARGIN, y);
  y += LINE_HEIGHT - 2;

  const history = [...client.transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  doc.setFont('helvetica', 'normal');
  if (history.length === 0) {
    doc.text('Aucune dette enregistrée pour ce client.', PAGE_MARGIN, y);
  } else {
    for (const tx of history) {
      if (y > pageHeight - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      const label = tx.note ?? (tx.type === 'DEBT' ? 'Dette' : 'Paiement reçu');
      const amount = `${tx.type === 'PAYMENT' ? '-' : ''}${formatPrice(tx.amountFcfa)} FCFA`;
      doc.text(formatDateFr(tx.createdAt), PAGE_MARGIN, y);
      doc.text(label.slice(0, 45), PAGE_MARGIN + 30, y);
      doc.text(amount, PAGE_MARGIN + 140, y);
      y += LINE_HEIGHT;
    }
  }

  return doc;
}

export function downloadClientHistoryPdf(client: PdfClientData, shopName: string | null): void {
  const doc = buildClientHistoryPdf(client, shopName);
  doc.save(buildPdfFilename(client.firstName));
}
