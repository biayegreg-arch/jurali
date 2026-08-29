import type { Metadata } from 'next';

// Authenticated app page (/payments/new) — excluded from search indexing
// (private user data).
export const metadata: Metadata = {
  title: 'Paiements',
  robots: { index: false, follow: false },
};

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
