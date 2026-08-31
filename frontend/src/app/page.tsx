// Jurali — Landing page (public marketing home). Reproduces Banani's
// LandingPage.jsx; see .planning/banani/landing-page.md for the routing
// decision (`/` moved from Dashboard to this screen — Dashboard is now at
// `/dashboard`) and copy/interaction fixes (trial language dropped, dead nav
// links removed, "Voir la démo" repointed to a real in-page anchor).
//
import Link from 'next/link';
import { Icon } from '@/components/jurali/Icon';
import { JuraliMark } from '@/components/jurali/JuraliMark';

const PROBLEMS = [
  {
    icon: 'alert-circle',
    title: 'Pertes financières',
    desc: 'Impossible de retrouver qui doit quoi',
  },
  { icon: 'clock', title: 'Temps perdu', desc: 'Chercher dans les carnets prend des heures' },
  { icon: 'users', title: 'Conflits clients', desc: 'Pas de preuve écrite = disputes' },
];

const FEATURES = [
  {
    icon: 'check-circle',
    title: 'Enregistre en 5 secondes',
    desc: 'Client + montant + articles. C’est tout. Jurali gère le reste.',
  },
  {
    icon: 'message-circle',
    title: 'Rappels WhatsApp auto',
    desc: '7 jours après, un message WhatsApp automatique. Tes clients n’oublient plus.',
  },
  {
    icon: 'trending-up',
    title: 'Stats en temps réel',
    desc: 'Vois qui doit quoi, qui est en retard, ton flux de cash au jour le jour.',
  },
  {
    icon: 'download',
    title: 'Exporte ce que tu veux',
    desc: 'PDF, CSV, reçus imprimables pour tes clients.',
  },
  {
    icon: 'cloud',
    title: 'Sauvegarde automatique',
    desc: 'Tes données sont toujours safe. Change de téléphone, pas de perte.',
  },
  {
    icon: 'shield',
    title: 'Sécurisé & privé',
    desc: 'Tes données restent tiennes. Jurali ne vend rien à personne.',
  },
];

const PRODUCT_POINTS = [
  'Thumb-opérable sur mobile',
  'Lisible en plein soleil',
  'Interface allégée pour les connexions lentes',
];

const STATS = [
  { number: '2 500+', label: 'boutiques' },
  { number: '50M', label: 'FCFA trackés' },
  { number: '95%', label: 'rétention' },
  { number: '4.8★', label: 'note moyenne' },
];

const TESTIMONIALS = [
  {
    name: 'Mamadou D.',
    city: 'Dakar',
    text: 'Avant, je perdais des centaines de milliers de FCFA par an. Avec Jurali, je vois tout d’un coup d’œil.',
  },
  {
    name: 'Fatou N.',
    city: 'Thiès',
    text: 'Simple à utiliser même pour moi qui ne suis pas très à l’aise avec la technologie. Je reçois exactement ce qu’il me faut.',
  },
  {
    name: 'Cheikh B.',
    city: 'Pikine',
    text: 'Le reçu que je peux donner à mes clients — c’est professionnel. Mes clients respectent ça. Plus de disputes.',
  },
];

const FREE_FEATURES = ['Jusqu’à 5 clients', 'Enregistrement des dettes', 'Historique complet'];
const PREMIUM_FEATURES = [
  'Clients illimités',
  'Rappels WhatsApp',
  'Statistiques avancées',
  'Export CSV & PDF',
  'Support prioritaire',
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Jurali',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Le carnet de crédit digital pour les boutiquiers sénégalais. Enregistre les dettes de tes clients en 5 secondes, reçois des rappels WhatsApp automatiques et suis tes statistiques en temps réel.',
  offers: [
    { '@type': 'Offer', name: 'Gratuit', price: '0', priceCurrency: 'XOF' },
    { '@type': 'Offer', name: 'Premium', price: '2500', priceCurrency: 'XOF' },
  ],
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '2500' },
};

export default function LandingPage() {
  return (
    <div className="bg-background font-body flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* === HEADER / NAV === */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-5 flex items-center justify-between">
          <JuraliMark size={30} textSize="text-xl md:text-2xl" />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#fonctionnalites" className="text-sm font-body text-foreground">
              Fonctionnalités
            </a>
            <a href="#tarif" className="text-sm font-body text-foreground">
              Tarif
            </a>
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/login"
              className="text-xs md:text-sm font-headings font-bold text-primary px-2.5 md:px-4 py-2"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="text-xs md:text-sm font-headings font-bold text-primary-foreground bg-primary px-3.5 md:px-5 py-2 md:py-2.5 rounded-xl"
            >
              Démarrer
            </Link>
          </div>
        </div>
      </header>

      {/* === HERO === */}
      <section className="bg-primary text-center py-14 md:py-20 px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs md:text-sm font-headings font-bold text-secondary uppercase tracking-wider mb-4">
            Gestion de dettes simplifiée
          </div>
          <h1 className="font-headings font-bold text-3xl md:text-5xl text-primary-foreground mb-6">
            Enregistre tes dettes en moins de 5 secondes
          </h1>
          <p className="text-base md:text-lg text-secondary mb-8 leading-relaxed">
            Plus de papier, plus d’erreurs. Jurali t’aide à suivre les dettes de tes clients
            automatiquement, avec rappels WhatsApp et statistiques en temps réel.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base px-8 py-4 rounded-xl"
            >
              <Icon i="check-circle" size={20} />
              Commencer gratuitement
            </Link>
            <a
              href="#produit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 border border-primary-foreground text-primary-foreground font-headings font-bold text-base px-8 py-4 rounded-xl"
            >
              <Icon i="play" size={18} />
              Voir la démo
            </a>
          </div>
          <p className="text-xs text-secondary mt-5">Sans carte bancaire pour démarrer</p>
        </div>
      </section>

      {/* === HERO IMAGE SPACE === */}
      <section className="bg-background px-4 md:px-8 py-10 md:py-12">
        <div className="max-w-5xl mx-auto bg-input border border-border rounded-2xl flex items-center justify-center min-h-[240px] md:min-h-[400px]">
          <div className="text-center">
            <Icon i="smartphone" size={56} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Dashboard Jurali en action</p>
          </div>
        </div>
      </section>

      {/* === PROBLEM / SOLUTION === */}
      <section className="bg-background px-4 md:px-8 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="font-headings font-bold text-2xl md:text-3xl text-foreground mb-3">
              Le papier, c’était hier
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Les boutiquiers perdent des milliers de FCFA chaque année en dettes oubliées ou mal
              notées.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {PROBLEMS.map((item) => (
              <div
                key={item.title}
                className="bg-input border border-border rounded-xl p-6 text-center"
              >
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Icon i={item.icon} size={24} className="text-primary" />
                </div>
                <h3 className="font-headings font-bold text-base text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === FEATURES === */}
      <section
        id="fonctionnalites"
        className="bg-primary text-primary-foreground px-4 md:px-8 py-12 md:py-16 scroll-mt-16"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="font-headings font-bold text-2xl md:text-3xl mb-3">
              Tout ce dont tu as besoin
            </h2>
            <p className="text-secondary text-sm md:text-base">
              Une boutique bien organisée, c’est une boutique rentable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {FEATURES.map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-1">
                  <Icon i={item.icon} size={20} className="text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-headings font-bold text-base mb-1">{item.title}</h3>
                  <p className="text-sm text-secondary">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === PRODUCT SECTION === */}
      <section id="produit" className="bg-background px-4 md:px-8 py-12 md:py-16 scroll-mt-16">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12 lg:items-center">
          <div className="flex-1">
            <div className="bg-input border border-border rounded-2xl aspect-video flex items-center justify-center">
              <Icon i="smartphone" size={64} className="text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs md:text-sm font-headings font-bold text-secondary uppercase tracking-wide mb-3">
              Interface simple
            </div>
            <h2 className="font-headings font-bold text-2xl md:text-3xl text-foreground mb-4">
              Un design pensé pour toi
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
              Pas de menus compliqués. Pas de boutons partout. Juste l’essentiel. Jurali reste
              lisible même en connexion lente — parfait pour Dakar.
            </p>
            <ul className="flex flex-col gap-3">
              {PRODUCT_POINTS.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Icon i="check" size={16} className="text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground font-headings font-bold">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* === STATS SECTION === */}
      <section className="bg-secondary border-y border-border px-4 md:px-8 py-10 md:py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-center">
          {STATS.map((item) => (
            <div key={item.label}>
              <div className="font-headings font-bold text-2xl md:text-3xl text-primary mb-1">
                {item.number}
              </div>
              <div className="text-xs text-muted-foreground font-body">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* === TESTIMONIALS === */}
      <section className="bg-background px-4 md:px-8 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="font-headings font-bold text-2xl md:text-3xl text-foreground mb-3">
              Ce qu’ils en disent
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Des boutiquiers sénégalais qui ont changé leur gestion de dettes
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-input border border-border rounded-xl p-6">
                <p className="text-sm text-foreground leading-relaxed italic mb-4">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="font-headings font-bold text-sm text-secondary-foreground">
                      {t.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-headings font-bold text-sm text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === PRICING === */}
      <section id="tarif" className="bg-background px-4 md:px-8 py-12 md:py-16 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="font-headings font-bold text-2xl md:text-3xl text-foreground mb-3">
              Simple &amp; transparent
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Choisis le plan qui te convient. Pas de surprise.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-input border border-border rounded-xl px-6 md:px-8 py-8 flex flex-col gap-4">
              <div>
                <h3 className="font-headings font-bold text-xl md:text-2xl text-foreground">
                  Gratuit
                </h3>
                <div className="font-headings font-bold text-2xl md:text-3xl text-foreground mt-2">
                  0{' '}
                  <span className="text-base font-body font-normal text-muted-foreground">
                    FCFA
                  </span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <ul className="flex flex-col gap-2.5">
                  {FREE_FEATURES.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <Icon i="check" size={14} className="text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/signup"
                className="text-center border border-border text-foreground font-headings font-bold text-sm py-3 rounded-xl"
              >
                Commencer
              </Link>
            </div>

            <div className="bg-primary text-primary-foreground rounded-xl px-6 md:px-8 py-8 flex flex-col gap-4 relative">
              <div className="absolute top-4 right-4">
                <span className="bg-accent text-accent-foreground font-headings font-bold text-xs px-2.5 py-1 rounded-lg">
                  Populaire
                </span>
              </div>
              <div>
                <h3 className="font-headings font-bold text-xl md:text-2xl">Premium</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="relative inline-block text-sm md:text-base font-body text-secondary">
                    3 900 FCFA
                    <span className="absolute inset-x-0 top-[65%] h-[2px] bg-danger" />
                  </span>
                  <span className="bg-danger text-danger-foreground font-headings font-bold text-[10px] md:text-xs px-2 py-0.5 rounded-md uppercase tracking-wide">
                    Promo
                  </span>
                </div>
                <div className="font-headings font-bold text-2xl md:text-3xl mt-1">
                  2 500{' '}
                  <span className="text-base font-body font-normal text-secondary">FCFA/mois</span>
                </div>
              </div>
              <div className="border-t border-primary-foreground/30 pt-4">
                <ul className="flex flex-col gap-2.5">
                  {PREMIUM_FEATURES.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <Icon i="check" size={14} className="text-accent flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/signup"
                className="text-center bg-accent text-accent-foreground font-headings font-bold text-sm py-3 rounded-xl"
              >
                Commencer
              </Link>
              <p className="text-xs text-secondary text-center">Sans carte bancaire</p>
            </div>
          </div>
        </div>
      </section>

      {/* === CTA SECTION === */}
      <section className="bg-primary text-center py-12 md:py-16 px-4 md:px-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-headings font-bold text-2xl md:text-3xl text-primary-foreground mb-3">
            Prêt à lancer ?
          </h2>
          <p className="text-secondary text-sm md:text-base mb-8">
            Rejoins les boutiquiers qui gagnent du temps et de l’argent chaque jour.
          </p>
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-headings font-bold text-base px-8 py-4 rounded-xl"
          >
            <Icon i="check-circle" size={20} />
            Commencer gratuitement maintenant
          </Link>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="bg-input border-t border-border px-4 md:px-8 py-10 md:py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <JuraliMark size={24} textSize="text-lg" className="mb-3" />
            <p className="text-xs text-muted-foreground">Pour les boutiquiers d’Afrique</p>
          </div>
          <div>
            <div className="font-headings font-bold text-sm text-foreground mb-3">Produit</div>
            <ul className="flex flex-col gap-2">
              <li>
                <a href="#fonctionnalites" className="text-xs text-muted-foreground">
                  Fonctionnalités
                </a>
              </li>
              <li>
                <a href="#tarif" className="text-xs text-muted-foreground">
                  Tarif
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-headings font-bold text-sm text-foreground mb-3">Compte</div>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/login" className="text-xs text-muted-foreground">
                  Se connecter
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-xs text-muted-foreground">
                  Créer un compte
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 text-center">
          <p className="text-xs text-muted-foreground">© 2026 Jurali. Tous droits réservés.</p>
          <span className="hidden sm:inline text-xs text-muted-foreground">·</span>
          <div className="flex items-center gap-3">
            <Link href="/cgu" className="text-xs text-muted-foreground underline">
              Conditions d’utilisation
            </Link>
            <span className="text-xs text-muted-foreground">·</span>
            <Link href="/confidentialite" className="text-xs text-muted-foreground underline">
              Confidentialité
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
