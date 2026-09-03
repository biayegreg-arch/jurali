import type { Metadata } from 'next';

// Authenticated app pages (/debts/new, /debts/overdue) — excluded from
// search indexing (private user data).
export const metadata: Metadata = {
  title: 'Dettes',
  robots: { index: false, follow: false },
};

export default function DebtsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
