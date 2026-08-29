import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://jurali.app';

// Public marketing surface: /, /login, /signup, /premium (pricing only —
// its private children below are disallowed individually). Everything else
// is an authenticated app page and gets no crawl budget; each also carries
// its own noindex meta as the authoritative signal (see each route's
// layout.tsx) — the Disallow here is just crawl-budget hygiene.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/clients',
        '/settings',
        '/stats',
        '/debts',
        '/payments',
        '/notifications',
        '/premium/manage',
        '/premium/checkout',
        '/premium/success',
        '/premium/failed',
        '/auth',
        '/api',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
