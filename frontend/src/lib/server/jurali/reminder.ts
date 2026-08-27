// WhatsApp reminder message + deep link — PRD 3.6/US-07, Phase 8. The
// template lives here (not duplicated in the route) so both the route and
// any future caller build the exact same wording. A `wa.me` link opens
// WhatsApp with the text pre-filled but NOT sent — the boutiquier still
// taps send inside WhatsApp, which is what satisfies US-07's "peut
// visualiser le message avant envoi" criterion without extra UI.
import { formatPrice } from '@/lib/utils';

export interface ReminderMessageInput {
  firstName: string;
  balanceFcfa: number;
  shopName: string | null;
}

export function buildReminderMessage({
  firstName,
  balanceFcfa,
  shopName,
}: ReminderMessageInput): string {
  const amount = formatPrice(balanceFcfa);
  const shop = shopName?.trim() || 'la boutique';
  return `Bonjour ${firstName}, tu as un solde de ${amount} FCFA chez ${shop}. Merci de passer régler dès que possible !`;
}

export function buildWhatsAppReminderUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
