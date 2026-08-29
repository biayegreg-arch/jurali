import type { Metadata } from 'next';

// OAuth error-landing page — excluded from search indexing.
export const metadata: Metadata = {
  title: 'Erreur de connexion',
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
