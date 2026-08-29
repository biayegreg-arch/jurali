import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connecte-toi à ton compte Jurali pour gérer les dettes de tes clients.',
  alternates: { canonical: '/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
