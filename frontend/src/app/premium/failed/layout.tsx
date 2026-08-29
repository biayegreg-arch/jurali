import type { Metadata } from 'next';

// Post-payment redirect page — excluded from search indexing (transactional,
// no evergreen content; overrides the public /premium layout's metadata).
export const metadata: Metadata = {
  title: 'Échec du paiement',
  robots: { index: false, follow: false },
};

export default function PremiumFailedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
