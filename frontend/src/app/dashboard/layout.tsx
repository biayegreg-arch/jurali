import type { Metadata } from 'next';

// Authenticated app page — excluded from search indexing (private user data,
// renders empty for a logged-out crawler).
export const metadata: Metadata = {
  title: 'Tableau de bord',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
