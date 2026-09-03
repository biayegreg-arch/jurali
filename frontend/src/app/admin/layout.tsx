import type { Metadata } from 'next';
import AdminLayoutClient from './AdminLayoutClient';

// Authenticated back-office — excluded from search indexing. Server
// component so it can export `metadata`; the actual shell (auth-gate,
// sidebar, nav) is a client component split into AdminLayoutClient.
export const metadata: Metadata = {
  title: 'Console Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
