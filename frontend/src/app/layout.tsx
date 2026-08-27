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

export const metadata: Metadata = {
  title: 'Jurali',
  description: 'Le carnet de crédit digital pour les boutiquiers sénégalais.',
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
