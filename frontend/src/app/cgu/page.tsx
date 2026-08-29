import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/jurali/Icon';

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
};

const LAST_UPDATED = '29 août 2026';

const ENTITY_NAME = 'Joal Immo';
const ENTITY_ADDRESS = 'Taiba 2, Grand Yoff N°397, Dakar';
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

export default function CguPage() {
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
              Conditions Générales d&rsquo;Utilisation
            </div>
            <div className="text-xs text-secondary">Dernière mise à jour : {LAST_UPDATED}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl w-full mx-auto flex flex-col gap-6">
        <Section title="1. Objet">
          <p>
            Les présentes Conditions Générales d&rsquo;Utilisation (« CGU ») régissent l&rsquo;accès
            et l&rsquo;utilisation de Jurali, un service en ligne permettant aux commerçants («
            l&rsquo;Utilisateur ») de suivre les dettes et paiements de leurs propres clients («
            carnet de crédit digital »), accessible à l&rsquo;adresse{' '}
            <span className="font-bold text-foreground">jurali.app</span>.
          </p>
          <p>
            Jurali est édité par {ENTITY_NAME}, {ENTITY_ADDRESS}. En créant un compte ou en
            utilisant le service, l&rsquo;Utilisateur accepte sans réserve les présentes CGU.
          </p>
        </Section>

        <Section title="2. Description du service">
          <p>
            Jurali permet d&rsquo;enregistrer des clients, de suivre leurs dettes et paiements, et
            d&rsquo;envoyer des rappels. Le service propose deux formules :
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>
              <span className="font-bold text-foreground">Gratuite</span> — jusqu&rsquo;à 5 clients,
              suivi des dettes et paiements, historique complet.
            </li>
            <li>
              <span className="font-bold text-foreground">Premium</span> — clients illimités,
              rappels WhatsApp (manuels et automatiques), alertes de retard, statistiques avancées,
              export CSV/PDF, pour 2 500 FCFA par mois.
            </li>
          </ul>
        </Section>

        <Section title="3. Création de compte">
          <p>
            L&rsquo;inscription requiert une adresse email valide (ou un numéro de téléphone selon
            le parcours choisi) et un mot de passe, ou une connexion via un compte Google.
            L&rsquo;Utilisateur est responsable de la confidentialité de ses identifiants et de
            toute activité effectuée depuis son compte. Toute utilisation frauduleuse constatée doit
            être signalée sans délai à {CONTACT_EMAIL}.
          </p>
        </Section>

        <Section title="4. Abonnement Premium et paiement">
          <p>
            L&rsquo;abonnement Premium est facturé 2 500 FCFA par mois, payable par Mobile Money
            (Wave, Orange Money, Free Money) via notre prestataire de paiement Bictorys.
          </p>
          <p>
            <span className="font-bold text-foreground">
              Le renouvellement n&rsquo;est pas automatique.
            </span>{' '}
            Le Mobile Money ne permettant pas de prélèvement récurrent, l&rsquo;Utilisateur doit
            relancer manuellement son paiement à l&rsquo;approche de la date d&rsquo;expiration (des
            rappels par email sont envoyés à cet effet). À défaut de renouvellement, le compte
            repasse automatiquement en formule Gratuite, sans perte des données enregistrées.
          </p>
          <p>
            L&rsquo;Utilisateur peut résilier son abonnement à tout moment depuis les paramètres de
            son compte. La résiliation est immédiate et ne donne pas lieu à un remboursement au
            prorata de la période déjà payée.
          </p>
        </Section>

        <Section title="5. Données saisies concernant les clients de l'Utilisateur">
          <p>
            Jurali permet à l&rsquo;Utilisateur d&rsquo;enregistrer des informations sur ses propres
            clients (nom, téléphone, montants dus) dans le cadre de son activité commerciale.
            L&rsquo;Utilisateur est seul responsable de la licéité de la collecte de ces données et
            doit s&rsquo;assurer d&rsquo;avoir informé ses clients conformément à la réglementation
            applicable en matière de protection des données personnelles. Jurali agit en tant que
            sous-traitant technique pour l&rsquo;hébergement de ces données.
          </p>
        </Section>

        <Section title="6. Propriété intellectuelle">
          <p>
            Le logo, la marque Jurali et l&rsquo;ensemble des éléments graphiques et logiciels du
            service sont la propriété exclusive de {ENTITY_NAME}. Toute reproduction non autorisée
            est interdite.
          </p>
        </Section>

        <Section title="7. Limitation de responsabilité">
          <p>
            Jurali est un outil d&rsquo;aide au suivi de dettes ; il ne constitue ni un service
            financier réglementé, ni un intermédiaire de recouvrement. L&rsquo;Utilisateur reste
            seul responsable des relations commerciales avec ses propres clients et de
            l&rsquo;exactitude des montants enregistrés. Jurali ne saurait être tenu responsable
            d&rsquo;une interruption temporaire du service, d&rsquo;une perte de connexion Mobile
            Money, ou d&rsquo;un litige entre l&rsquo;Utilisateur et l&rsquo;un de ses clients.
          </p>
        </Section>

        <Section title="8. Résiliation du compte">
          <p>
            L&rsquo;Utilisateur peut supprimer son compte à tout moment. Jurali se réserve le droit
            de suspendre ou résilier un compte en cas de violation des présentes CGU, de fraude
            avérée, ou d&rsquo;usage abusif du service.
          </p>
        </Section>

        <Section title="9. Modification des CGU">
          <p>
            Les présentes CGU peuvent être modifiées à tout moment. Les Utilisateurs seront informés
            de toute modification substantielle. La poursuite de l&rsquo;utilisation du service
            après modification vaut acceptation des nouvelles CGU.
          </p>
        </Section>

        <Section title="10. Droit applicable">
          <p>
            Les présentes CGU sont soumises au droit sénégalais. Tout litige relatif à leur
            interprétation ou leur exécution relève de la compétence exclusive des tribunaux
            compétents du Sénégal.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Pour toute question relative aux présentes CGU :{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-bold">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
}
