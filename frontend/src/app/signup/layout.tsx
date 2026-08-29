import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Créer un compte',
  description:
    'Crée ton compte Jurali gratuitement et commence à suivre les dettes de tes clients en moins de 5 secondes.',
  alternates: { canonical: '/signup' },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
