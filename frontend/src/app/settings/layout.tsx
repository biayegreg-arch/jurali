import type { Metadata } from 'next';

// Authenticated app page — excluded from search indexing (private user data).
export const metadata: Metadata = {
  title: 'Paramètres',
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
