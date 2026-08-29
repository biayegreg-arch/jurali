import type { Metadata } from 'next';
import { DM_Sans, Space_Grotesk } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { EASE_PREMIUM } from '@/lib/motion';

// Jurali's typography, per the Banani design tokens (globals.css @theme):
// DM Sans for body text, Space Grotesk for headings.
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://jurali.app';
const DEFAULT_DESCRIPTION =
  'Le carnet de crédit digital pour les boutiquiers sénégalais. Enregistre les dettes de tes clients en 5 secondes, reçois des rappels WhatsApp automatiques et suis tes statistiques en temps réel.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Jurali — Le carnet de crédit digital pour boutiquiers',
    template: '%s | Jurali',
  },
  description: DEFAULT_DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'fr_SN',
    siteName: 'Jurali',
    title: 'Jurali — Le carnet de crédit digital pour boutiquiers',
    description: DEFAULT_DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'Jurali — Le carnet de crédit digital pour boutiquiers',
    description: DEFAULT_DESCRIPTION,
  },
  verification: {
    google: 'lDCezVSHlymtHljRUR1v8yCJLkye9lOccVb1X0RB1C8',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className={`${dmSans.className} font-body`}>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: EASE_PREMIUM }}>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
