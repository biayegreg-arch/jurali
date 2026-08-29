import type { Metadata } from 'next';

// Authenticated app page — excluded from search indexing (private user data).
export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
