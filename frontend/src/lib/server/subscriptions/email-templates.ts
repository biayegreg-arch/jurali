// Renewal-reminder email copy — French (the rest of the Jurali UI is
// French-only; unlike auth/email-templates.ts, which ships English by
// default for the generic starter, this domain is already localized).
// Mirrors auth/email-templates.ts's EmailTemplate shape and htmlEscape
// discipline: every interpolated value flows through htmlEscape() even
// though today's inputs (formatted FCFA amounts, a fixed manage URL) are
// never user-controlled — cheap insurance against a future template reuse.
import 'server-only';
import { formatPrice } from '@/lib/utils';
import { CLIENT_FREE_TIER_LIMIT } from '@/lib/server/jurali/client-limits';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SubscriptionExpiringEmailArgs {
  daysLeft: 1 | 3;
  planAmountFcfa: number;
  manageUrl: string;
}

export function subscriptionExpiringEmail(args: SubscriptionExpiringEmailArgs): EmailTemplate {
  const price = htmlEscape(formatPrice(args.planAmountFcfa, 'FCFA'));
  const url = htmlEscape(args.manageUrl);
  const when = args.daysLeft === 1 ? 'demain' : `dans ${args.daysLeft} jours`;
  const subject =
    args.daysLeft === 1
      ? 'Ton abonnement Jurali Premium expire demain'
      : `Ton abonnement Jurali Premium expire ${when}`;

  return {
    subject,
    html: `<p>Bonjour,</p><p>Ton abonnement <strong>Jurali Premium</strong> expire <strong>${when}</strong>. Comme le paiement se fait par Mobile Money, il n'est pas renouvelé automatiquement — il faut le relancer toi-même.</p><p>Renouvelle dès maintenant pour ne pas perdre l'accès aux clients illimités, aux rappels WhatsApp, aux statistiques et à l'export : <a href="${url}">${url}</a></p><p>Montant : <strong>${price}/mois</strong>.</p>`,
    text: `Bonjour,\n\nTon abonnement Jurali Premium expire ${when}. Comme le paiement se fait par Mobile Money, il n'est pas renouvelé automatiquement — il faut le relancer toi-même.\n\nRenouvelle dès maintenant : ${args.manageUrl}\n\nMontant : ${formatPrice(args.planAmountFcfa, 'FCFA')}/mois.`,
  };
}

export interface SubscriptionExpiredEmailArgs {
  planAmountFcfa: number;
  manageUrl: string;
}

export function subscriptionExpiredEmail(args: SubscriptionExpiredEmailArgs): EmailTemplate {
  const price = htmlEscape(formatPrice(args.planAmountFcfa, 'FCFA'));
  const url = htmlEscape(args.manageUrl);

  return {
    subject: 'Ton abonnement Jurali Premium a expiré',
    html: `<p>Bonjour,</p><p>Ton abonnement <strong>Jurali Premium</strong> vient d'expirer et ton compte est repassé en offre <strong>Gratuite</strong> (limité à ${CLIENT_FREE_TIER_LIMIT} clients, sans rappels WhatsApp ni statistiques).</p><p>Réabonne-toi à tout moment pour ${price}/mois : <a href="${url}">${url}</a></p>`,
    text: `Bonjour,\n\nTon abonnement Jurali Premium vient d'expirer et ton compte est repassé en offre Gratuite (limité à ${CLIENT_FREE_TIER_LIMIT} clients, sans rappels WhatsApp ni statistiques).\n\nRéabonne-toi à tout moment pour ${formatPrice(args.planAmountFcfa, 'FCFA')}/mois : ${args.manageUrl}`,
  };
}
