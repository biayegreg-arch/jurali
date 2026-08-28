// Shared by /premium, /premium/checkout and /premium/manage — every entry
// here must correspond to a real, server-enforced gate (see each icon's
// route below), never an aspirational feature. Kept in one place after
// the three Premium screens all needed the identical list.
export interface PremiumFeature {
  label: string;
  icon: string;
}

// POST /api/clients (client cap waiver), POST /api/clients/[id]/remind +
// cron/auto-reminders (WhatsApp), cron/overdue-alerts (retard digest),
// GET /api/stats, GET /api/clients/export + the fiche-client PDF export.
// "Historique illimité" is real too — there is no history truncation for
// any tier, so it's true for both, but only worth stating as a Premium
// selling point since a free-tier competitor product might truncate it.
export const PREMIUM_FEATURES: PremiumFeature[] = [
  { label: 'Clients illimités', icon: 'users' },
  { label: 'Rappels WhatsApp (manuel + automatique)', icon: 'message-circle' },
  { label: 'Alertes dettes en retard (résumé quotidien)', icon: 'bell' },
  { label: 'Statistiques avancées', icon: 'bar-chart-2' },
  { label: 'Export CSV & PDF', icon: 'download' },
  { label: 'Historique illimité', icon: 'clock' },
];
