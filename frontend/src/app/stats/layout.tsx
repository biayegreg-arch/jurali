import type { Metadata } from 'next';

// Authenticated app page — excluded from search indexing (private user data).
export const metadata: Metadata = {
  title: 'Statistiques',
  robots: { index: false, follow: false },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
