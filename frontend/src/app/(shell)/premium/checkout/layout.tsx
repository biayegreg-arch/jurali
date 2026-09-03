import type { Metadata } from 'next';

// Authenticated checkout page — excluded from search indexing (private,
// transactional; overrides the public /premium layout's metadata).
export const metadata: Metadata = {
  title: 'Paiement',
  robots: { index: false, follow: false },
};

export default function PremiumCheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
