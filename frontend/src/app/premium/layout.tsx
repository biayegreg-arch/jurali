import type { Metadata } from 'next';

// Public pricing page. Children under /premium (manage, checkout, success,
// failed) are private/transactional and override this with their own
// noindex layout — see each subfolder's layout.tsx.
export const metadata: Metadata = {
  title: { default: 'Tarifs', template: '%s | Jurali' },
  description:
    'Jurali Premium : clients illimités, rappels WhatsApp automatiques, statistiques avancées et export CSV/PDF pour 2 500 FCFA/mois.',
  alternates: { canonical: '/premium' },
};

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
