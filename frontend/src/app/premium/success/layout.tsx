import type { Metadata } from 'next';

// Post-payment redirect page — excluded from search indexing (transactional,
// no evergreen content; overrides the public /premium layout's metadata).
export const metadata: Metadata = {
  title: 'Paiement réussi',
  robots: { index: false, follow: false },
};

export default function PremiumSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
