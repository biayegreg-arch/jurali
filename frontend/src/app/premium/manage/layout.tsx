import type { Metadata } from 'next';

// Authenticated subscription-management page — excluded from search indexing
// (private user data; overrides the public /premium layout's metadata).
export const metadata: Metadata = {
  title: 'Gérer mon abonnement',
  robots: { index: false, follow: false },
};

export default function PremiumManageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
