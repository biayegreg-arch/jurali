import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/jurali/Icon';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité',
};

const LAST_UPDATED = '29 août 2026';

// [À COMPLÉTER avant publication] — mêmes informations que /cgu.
const ENTITY_NAME = '[Nom de l’entité / raison sociale à compléter]';
const ENTITY_ADDRESS = '[Adresse du siège à compléter], Sénégal';
const CONTACT_EMAIL = 'contact@jurali.app';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-headings font-bold text-lg text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
        {children}
      </div>
    </section>
  );
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-dvh bg-background font-body flex flex-col">
      <div className="bg-primary px-4 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
          >
            <Icon i="chevron-left" size={20} className="text-primary-foreground" />
          </Link>
          <div>
            <div className="font-headings font-bold text-lg text-primary-foreground">
              Politique de Confidentialité
            </div>
            <div className="text-xs text-secondary">Dernière mise à jour : {LAST_UPDATED}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl w-full mx-auto flex flex-col gap-6">
        <Section title="1. Responsable du traitement">
          <p>
            {ENTITY_NAME}, {ENTITY_ADDRESS}, est responsable du traitement des données à caractère
            personnel collectées via Jurali (jurali.app), conformément à la loi sénégalaise n°
            2008-12 du 25 janvier 2008 portant sur la protection des données à caractère personnel.
          </p>
        </Section>

        <Section title="2. Données que nous collectons">
          <p>
            <span className="font-bold text-foreground">Données de compte</span> — email et/ou
            numéro de téléphone, mot de passe (chiffré), nom de la boutique, adresse (optionnelle),
            et, en cas de connexion via Google, le nom et la photo de profil associés.
          </p>
          <p>
            <span className="font-bold text-foreground">
              Données saisies par l&rsquo;Utilisateur
            </span>{' '}
            — informations sur ses propres clients (nom, téléphone, montants dus et payés),
            enregistrées à des fins de suivi commercial. Ces données ne sont jamais consultées ni
            utilisées par Jurali à d&rsquo;autres fins que la fourniture du service.
          </p>
          <p>
            <span className="font-bold text-foreground">Données de paiement</span> — lors d&rsquo;un
            abonnement Premium, les informations de paiement Mobile Money sont traitées directement
            par notre prestataire Bictorys ; Jurali ne stocke ni ne voit jamais le code confidentiel
            Mobile Money.
          </p>
          <p>
            <span className="font-bold text-foreground">Données techniques</span> — adresse IP,
            identifiant de requête, et journaux d&rsquo;erreurs à des fins de sécurité et de
            diagnostic technique.
          </p>
        </Section>

        <Section title="3. Finalités du traitement">
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Fournir et sécuriser l&rsquo;accès au service (authentification, sessions).</li>
            <li>Traiter les abonnements et paiements Premium.</li>
            <li>
              Envoyer les emails transactionnels (vérification de compte, réinitialisation de mot de
              passe, rappels d&rsquo;abonnement).
            </li>
            <li>
              Prévenir la fraude et les usages abusifs (limitation de tentatives de connexion).
            </li>
            <li>Améliorer la fiabilité du service (diagnostic d&rsquo;erreurs techniques).</li>
          </ul>
        </Section>

        <Section title="4. Partage des données">
          <p>
            Jurali ne vend ni ne loue aucune donnée personnelle. Certaines données sont partagées
            avec des prestataires techniques, uniquement dans la mesure nécessaire au fonctionnement
            du service :
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>
              <span className="font-bold text-foreground">Bictorys</span> — traitement des paiements
              Mobile Money.
            </li>
            <li>
              <span className="font-bold text-foreground">Resend</span> — envoi des emails
              transactionnels.
            </li>
            <li>
              <span className="font-bold text-foreground">Vercel, Neon, Upstash</span> — hébergement
              de l&rsquo;application, de la base de données et de l&rsquo;infrastructure technique.
            </li>
          </ul>
          <p>
            Ces prestataires peuvent héberger des données en dehors du Sénégal (Union Européenne ou
            États-Unis selon le service). Nous veillons à ne travailler qu&rsquo;avec des
            prestataires offrant des garanties de sécurité appropriées.
          </p>
        </Section>

        <Section title="5. Durée de conservation">
          <p>
            Les données de compte et les données clients saisies sont conservées tant que le compte
            est actif. En cas de suppression du compte, les données sont supprimées ou anonymisées
            dans un délai raisonnable, sauf obligation légale de conservation plus longue (notamment
            les journaux liés aux paiements).
          </p>
        </Section>

        <Section title="6. Sécurité">
          <p>
            Les mots de passe sont stockés sous forme chiffrée (jamais en clair). Les échanges avec
            le service sont chiffrés (HTTPS). L&rsquo;accès aux données est restreint aux seules
            personnes en ayant besoin pour assurer le fonctionnement du service.
          </p>
        </Section>

        <Section title="7. Vos droits">
          <p>
            Conformément à la loi n° 2008-12 et sous le contrôle de la Commission de protection des
            données personnelles (CDP) du Sénégal, vous disposez d&rsquo;un droit d&rsquo;accès, de
            rectification, de suppression et d&rsquo;opposition concernant vos données personnelles.
            Vous pouvez exercer ces droits en nous contactant à{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-bold">
              {CONTACT_EMAIL}
            </a>
            , ou introduire une réclamation auprès de la CDP.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            Jurali utilise uniquement des cookies strictement nécessaires au fonctionnement du
            service (session de connexion, protection contre la falsification de requêtes). Aucun
            cookie publicitaire ou de suivi tiers n&rsquo;est utilisé.
          </p>
        </Section>

        <Section title="9. Modifications">
          <p>
            Cette politique peut être mise à jour périodiquement. La date de dernière mise à jour
            est indiquée en haut de cette page.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Pour toute question relative à vos données personnelles :{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-bold">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
}
