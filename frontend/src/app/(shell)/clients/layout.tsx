import type { Metadata } from 'next';

// Authenticated app pages (/clients, /clients/new, /clients/[id],
// /clients/[id]/edit) — excluded from search indexing (private user data).
export const metadata: Metadata = {
  title: 'Clients',
  robots: { index: false, follow: false },
};

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
