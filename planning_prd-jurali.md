# PRD — Jurali

## 1. Vision produit

**Pitch en une phrase**
Jurali est le carnet de crédit digital qui permet aux boutiquiers sénégalais de savoir instantanément qui leur doit de l'argent, combien, et depuis quand — puis de récupérer cet argent plus vite.

**Problème résolu**
Chaque jour, des milliers de boutiquiers de quartier au Sénégal vendent à crédit à leurs clients réguliers. Ils notent les dettes sur un carnet papier (quand ils notent). Ce carnet se perd, s'abîme, les écritures deviennent illisibles, les montants s'accumulent sans suivi, et le boutiquier finit par oublier — ou par ne pas oser réclamer faute de preuve claire. Résultat : il perd de l'argent chaque mois sans même savoir combien.

**Pourquoi maintenant**
- KhataBook a prouvé en Inde que le marché du carnet de crédit digital vaut des centaines de millions de dollars ($600M de valorisation en 2021). Ce modèle n'a aucun équivalent localisé en Afrique francophone.
- La pénétration du smartphone Android au Sénégal dépasse désormais 60%, même chez les petits commerçants.
- Wave et Orange Money sont devenus des réflexes quotidiens pour cette cible — la confiance dans les outils mobiles financiers est installée.
- Le seul concurrent direct identifié ("Carnet de Dettes" en Côte d'Ivoire) est 100% offline sans aucune synchronisation ni rappel — un produit inerte.

**Ce que Jurali règle concrètement pour le boutiquier :**

| Douleur aujourd'hui | Solution Jurali |
|---|---|
| **Perte de mémoire** — Le boutiquier oublie qui lui doit quoi après quelques jours. Le carnet papier est incomplet ou perdu. | Une base de données personnelle, consultable en 2 secondes, avec le solde total et le détail par client. |
| **Pas de visibilité globale** — Il ne connaît pas le montant total de ses créances. Il ne sait pas s'il perd ou gagne de l'argent. | Un tableau de bord avec 4 chiffres clés : total à récupérer, nombre de débiteurs, dettes anciennes, récupéré ce mois. |
| **Difficulté à réclamer** — Relancer un client est gênant socialement. Sans preuve écrite claire, le client conteste. | Historique horodaté de chaque transaction + rappels automatiques envoyés via WhatsApp (le boutiquier n'a pas à relancer lui-même). |
| **Enregistrement lent et fastidieux** — Ouvrir le carnet, trouver la bonne page, écrire le montant, la date… ça prend du temps pendant que d'autres clients attendent. | Ajout d'une dette en moins de 5 secondes : toucher le nom du client → taper le montant → valider. |
| **Aucune sauvegarde** — Si le carnet brûle, est volé ou prend l'eau, tout est perdu. | Données sauvegardées dans le cloud, accessibles depuis n'importe quel appareil. |

---

## 2. Personas cibles

### Persona 1 — Mamadou, 42 ans, boutiquier de quartier à Pikine (Dakar)

- **Profil** : Tient une boutique de proximité (alimentation générale) dans un quartier populaire. Vend du riz, de l'huile, du sucre, du savon. 80% de ses clients habitent à moins de 200 mètres.
- **Pain points** :
  - Vend à crédit à 30-50 clients réguliers. Note les dettes dans un cahier d'écolier qu'il range sous le comptoir. Perd régulièrement le fil.
  - Estime qu'il "oublie" au moins 25 000-50 000 FCFA par mois en créances non réclamées.
  - N'ose pas toujours relancer ses voisins — la relation sociale prime.
  - A déjà perdu un carnet complet lors d'un dégât des eaux.
- **Outils actuels** : Cahier papier + sa mémoire. Utilise WhatsApp quotidiennement. Paye tout via Wave.
- **Pouvoir d'achat** : Marge nette de 150 000-250 000 FCFA/mois. 2 500 FCFA/mois est un investissement acceptable si le retour est visible.
- **Téléphone** : Samsung Galaxy A04 ou équivalent, Android, écran 6", connexion 4G intermittente.

### Persona 2 — Aïssatou, 35 ans, vendeuse de tissu au marché Sandaga (Dakar)

- **Profil** : Vend des pagnes et tissus dans une cantina au marché. Ses clientes achètent souvent à crédit (un pagne à 15 000 FCFA, payé en 2-3 fois). Volume de créances plus élevé que le boutiquier classique.
- **Pain points** :
  - Gère un cahier dédié aux crédits, mais les remboursements partiels rendent le suivi cauchemardesque (ratures, calculs faux).
  - A des clientes qu'elle ne voit qu'une fois par semaine — impossible de relancer en face-à-face.
  - Partage parfois sa boutique avec une associée — aucun moyen de synchroniser les dettes notées par l'une et l'autre.
- **Outils actuels** : Cahier papier + calculatrice physique. WhatsApp pour contacter ses clientes. Orange Money pour les paiements.
- **Pouvoir d'achat** : Marge nette de 200 000-400 000 FCFA/mois. 2 500 FCFA est négligeable si elle récupère ne serait-ce que 2 clientes "oubliées" par mois.
- **Téléphone** : Tecno Spark ou Infinix Hot, Android, écran 6.5".

### Persona 3 — Ousmane, 28 ans, gérant de kiosque télécom à Thiès

- **Profil** : Vend du crédit téléphonique, des accessoires, fait du transfert d'argent. Donne aussi du crédit à ses clients réguliers (petits montants : 500-2 000 FCFA). Beaucoup de micro-transactions.
- **Pain points** :
  - Les montants sont petits mais nombreux (parfois 20 crédits par jour). Le cahier ne suit plus.
  - Impossible de savoir en fin de journée combien il est censé avoir en caisse vs ce qui est "dans la nature".
  - Certains clients jurent avoir déjà remboursé. Sans preuve horodatée, il cède.
- **Outils actuels** : Pas de cahier (trop de volume) → sa mémoire seule. WhatsApp. Wave.
- **Pouvoir d'achat** : Marge nette de 80 000-150 000 FCFA/mois. Sensible au prix mais perdrait facilement 10 000-20 000 FCFA/mois en créances oubliées.
- **Téléphone** : Itel ou Tecno d'entrée de gamme, Android Go, écran 5.5"-6", stockage limité.

---

## 3. Pages & écrans

### Parcours d'onboarding (première utilisation)

**3.1 — Écran de bienvenue / Inscription**
- **Rôle** : Permettre au boutiquier de créer son compte en quelques secondes.
- **Qui y accède** : Tout nouvel utilisateur, à la première ouverture.
- **Actions clés** :
  - Saisir son prénom et son numéro de téléphone
  - Recevoir un code de vérification par SMS et le saisir
  - Accéder directement à l'écran d'accueil (aucune étape supplémentaire)

### Parcours principal (usage quotidien)

**3.2 — Accueil (Tableau de bord)**
- **Rôle** : Donner au boutiquier une vision instantanée de sa situation financière en matière de crédit.
- **Qui y accède** : Le boutiquier à chaque ouverture de l'application.
- **Actions clés** :
  - Consulter les 4 indicateurs clés (total à récupérer, nombre de clients débiteurs, dettes anciennes, récupéré ce mois)
  - Lancer l'ajout d'une nouvelle dette (bouton principal)
  - Lancer l'enregistrement d'un paiement reçu (bouton principal)
  - Consulter la liste des clients récents avec leur solde

**3.3 — Nouvelle dette**
- **Rôle** : Permettre au boutiquier d'enregistrer un achat à crédit en moins de 5 secondes.
- **Qui y accède** : Le boutiquier, depuis l'accueil ou la fiche client, à chaque fois qu'un client achète à crédit.
- **Actions clés** :
  - Sélectionner un client existant (recherche par nom/téléphone) ou en créer un nouveau à la volée
  - Saisir le montant sur un grand pavé numérique
  - Ajouter une note optionnelle (ex: "sac de riz 25kg")
  - Valider l'enregistrement en un tap

**3.4 — Paiement reçu**
- **Rôle** : Permettre au boutiquier d'enregistrer un remboursement (total ou partiel) d'un client.
- **Qui y accède** : Le boutiquier, depuis l'accueil ou la fiche client, quand un client vient rembourser.
- **Actions clés** :
  - Sélectionner le client qui rembourse
  - Saisir le montant remboursé
  - Voir le solde restant mis à jour instantanément
  - Valider l'enregistrement

**3.5 — Liste des clients**
- **Rôle** : Permettre au boutiquier de voir tous ses clients débiteurs, triés par montant dû ou ancienneté.
- **Qui y accède** : Le boutiquier, quand il veut consulter l'ensemble de ses débiteurs.
- **Actions clés** :
  - Parcourir la liste des clients avec leur solde affiché
  - Rechercher un client par nom ou numéro de téléphone
  - Accéder à la fiche détaillée d'un client en tapant dessus
  - Identifier visuellement les dettes anciennes (indicateur visuel de retard)

**3.6 — Fiche client**
- **Rôle** : Afficher l'historique complet des transactions (dettes et remboursements) avec un client spécifique.
- **Qui y accède** : Le boutiquier, quand il veut vérifier le détail d'un client ou trancher un litige ("tu me dois combien exactement ?").
- **Actions clés** :
  - Voir le solde actuel du client
  - Consulter l'historique chronologique de toutes les dettes et remboursements (montant, date, note)
  - Ajouter une dette directement depuis cette fiche
  - Enregistrer un paiement directement depuis cette fiche
  - Envoyer un rappel au client (Premium)

### Parcours secondaire

**3.7 — Paramètres / Mon compte**
- **Rôle** : Gérer son profil, son abonnement, et les réglages de l'application.
- **Qui y accède** : Le boutiquier, ponctuellement.
- **Actions clés** :
  - Modifier son nom et son numéro de téléphone
  - Voir et gérer son abonnement (gratuit → Premium)
  - Se déconnecter

**3.8 — Page d'abonnement Premium**
- **Rôle** : Présenter l'offre Premium et permettre au boutiquier de s'abonner.
- **Qui y accède** : Le boutiquier qui atteint la limite de 10 clients OU qui tente d'utiliser une fonctionnalité Premium (rappels, export…).
- **Actions clés** :
  - Voir la comparaison gratuit vs Premium
  - Choisir son moyen de paiement (Wave, Orange Money)
  - S'abonner en un tap

---

## 4. Fonctionnalités MVP (V1)

### Onboarding & Authentification

| Feature | Description | Priorité |
|---|---|---|
| **Inscription par téléphone** | Le boutiquier crée son compte avec son prénom + numéro de téléphone + code SMS. Aucun email requis. | P0 |
| **Connexion par code SMS** | Connexion sans mot de passe : numéro de téléphone → code SMS → accès. Pas de mot de passe à retenir. | P0 |
| **Session persistante** | Une fois connecté, le boutiquier reste connecté indéfiniment sur son appareil (sauf déconnexion manuelle). | P0 |

### Tableau de bord (Accueil)

| Feature | Description | Priorité |
|---|---|---|
| **Indicateurs globaux** | 4 chiffres affichés immédiatement : total à récupérer, nombre de clients débiteurs, montant des dettes anciennes (> 30 jours), total récupéré ce mois-ci. | P0 |
| **Boutons d'action rapide** | 2 boutons de grande taille toujours visibles : "Ajouter une dette" et "Paiement reçu". Ce sont les 2 actions que le boutiquier fait 20 fois par jour. | P0 |
| **Clients récents** | Afficher les 5 derniers clients avec lesquels une transaction a eu lieu, avec leur solde actuel. Un tap ouvre la fiche client. | P0 |

### Gestion des dettes

| Feature | Description | Priorité |
|---|---|---|
| **Ajout de dette rapide** | Flux en 2 étapes : 1) sélectionner le client, 2) taper le montant sur un grand pavé numérique. Cible : < 5 secondes pour un client existant. | P0 |
| **Note optionnelle sur la dette** | Champ texte libre pour décrire l'achat ("2 sacs de riz", "pagne bleu"). Optionnel — ne ralentit pas le flux. | P1 |
| **Horodatage automatique** | Chaque dette est automatiquement datée et horodatée. Le boutiquier ne saisit jamais la date manuellement. | P0 |

### Gestion des remboursements

| Feature | Description | Priorité |
|---|---|---|
| **Enregistrement de paiement** | Sélectionner le client → saisir le montant remboursé → le solde se met à jour. Remboursement partiel ou total. | P0 |
| **Solde client mis à jour en temps réel** | Après chaque paiement, le solde du client et les indicateurs globaux se recalculent instantanément. | P0 |

### Gestion des clients

| Feature | Description | Priorité |
|---|---|---|
| **Création de client rapide** | Lors de l'ajout d'une dette, si le client n'existe pas, le boutiquier peut le créer à la volée : prénom + numéro de téléphone (optionnel). | P0 |
| **Recherche de client** | Recherche par nom ou par numéro de téléphone dans la liste des clients. Résultats en temps réel pendant la saisie. | P0 |
| **Liste des clients avec solde** | Tous les clients sont listés avec leur solde actuel affiché. Tri possible par montant dû (décroissant) ou par ancienneté de la dernière dette. | P0 |
| **Indicateur de dette ancienne** | Les clients dont la dette la plus ancienne dépasse 30 jours sont marqués visuellement (couleur, badge). Permet au boutiquier de prioriser ses relances. | P1 |

### Fiche client

| Feature | Description | Priorité |
|---|---|---|
| **Historique des transactions** | Liste chronologique de toutes les dettes et remboursements d'un client, avec date, montant et note. | P0 |
| **Actions rapides depuis la fiche** | Boutons "Ajouter une dette" et "Paiement reçu" directement sur la fiche client, pré-remplis avec ce client. | P0 |

### Abonnement & Monétisation

| Feature | Description | Priorité |
|---|---|---|
| **Limite gratuite à 10 clients** | Au-delà de 10 clients créés, l'ajout d'un nouveau client déclenche l'écran d'upgrade Premium. Les 10 clients existants restent fonctionnels. | P0 |
| **Page d'abonnement Premium** | Comparaison visuelle gratuit vs Premium. Mise en avant du prix barré (~~5 000 FCFA~~ → 2 500 FCFA/mois). Bouton de paiement. | P0 |
| **Paiement via mobile money** | Le boutiquier s'abonne en payant via Wave ou Orange Money. Processus intégré, pas de redirection externe complexe. | P0 |
| **Gestion de l'abonnement** | Le boutiquier peut voir son statut (gratuit/Premium), la date de renouvellement, et annuler depuis les paramètres. | P1 |

### Fonctionnalités Premium

| Feature | Description | Priorité |
|---|---|---|
| **Clients illimités** | Suppression de la limite de 10 clients. | P0 |
| **Rappels WhatsApp** | Le boutiquier peut envoyer un rappel automatique à un client via WhatsApp, avec un message pré-rédigé incluant le montant dû. Le client reçoit un message du type : "Bonjour Awa, vous avez un solde de 15 500 FCFA chez Boutique Mamadou. Merci de passer régler." | P1 |
| **Historique complet** | En gratuit, l'historique est limité aux 30 derniers jours. En Premium, accès à tout l'historique sans limite. | P1 |
| **Sync multi-appareils** | Le boutiquier accède à ses données depuis un autre téléphone ou un navigateur. Utile si le téléphone tombe en panne ou s'il partage la boutique avec un associé. | P2 |
| **Export PDF/Excel** | Exporter la liste des clients et des dettes en PDF ou Excel. Utile pour faire le bilan du mois ou pour montrer à un partenaire/banquier. | P2 |

---

## 5. User Stories principales

### US-01 : Enregistrer une dette en quelques secondes

> En tant que **Mamadou (boutiquier)**, je veux **enregistrer l'achat à crédit d'un client en moins de 5 secondes** afin de **ne pas perdre le fil pendant que d'autres clients attendent au comptoir**.

**Critères d'acceptation :**
- Le boutiquier peut sélectionner un client parmi ses clients récents en un seul tap
- Le pavé numérique s'affiche immédiatement en plein écran après la sélection du client
- La validation se fait en un seul tap après la saisie du montant
- La dette apparaît immédiatement dans l'historique du client
- Le solde total de l'accueil est mis à jour instantanément
- L'ensemble du flux (sélection client + saisie montant + validation) est réalisable en 3 taps maximum pour un client récent

### US-02 : Savoir instantanément combien on me doit au total

> En tant que **Mamadou (boutiquier)**, je veux **voir en un coup d'œil le montant total de mes créances en cours** afin de **savoir à tout moment combien d'argent est "dans la nature"**.

**Critères d'acceptation :**
- Le montant total à récupérer est affiché en gros à l'ouverture de l'application
- Le nombre de clients débiteurs est affiché
- Le montant des dettes de plus de 30 jours est affiché séparément
- Le total récupéré depuis le début du mois est affiché
- Tous ces chiffres se mettent à jour en temps réel après chaque opération

### US-03 : Enregistrer un remboursement partiel

> En tant que **Aïssatou (vendeuse de tissu)**, je veux **enregistrer le remboursement partiel d'une cliente** afin de **suivre précisément le solde restant sans erreur de calcul**.

**Critères d'acceptation :**
- Le boutiquier sélectionne le client et saisit le montant remboursé
- Le solde du client est automatiquement recalculé (ancien solde - remboursement)
- Le remboursement apparaît dans l'historique du client avec la date et le montant
- Si le remboursement est égal au solde, le client passe à "solde 0" mais reste dans la liste (au cas où il reprend du crédit plus tard)
- Le total à récupérer de l'accueil est mis à jour

### US-04 : Retrouver l'historique d'un client en cas de litige

> En tant que **Ousmane (gérant de kiosque)**, je veux **consulter l'historique complet des dettes et remboursements d'un client spécifique** afin de **prouver le montant exact qu'il me doit quand il conteste**.

**Critères d'acceptation :**
- La fiche client affiche le solde actuel en gros en haut
- La liste de toutes les transactions est affichée par ordre chronologique inverse (la plus récente en haut)
- Chaque transaction indique : le type (dette ou remboursement), le montant, la date, et la note éventuelle
- Le boutiquier peut montrer cet écran directement au client sur son téléphone

### US-05 : Créer un nouveau client rapidement

> En tant que **Mamadou (boutiquier)**, je veux **ajouter un nouveau client au moment même où il achète à crédit** afin de **ne pas bloquer la file d'attente avec de la saisie administrative**.

**Critères d'acceptation :**
- Lors de l'ajout d'une dette, si le client n'est pas trouvé dans la recherche, un bouton "Créer un nouveau client" apparaît
- La création nécessite uniquement un prénom (le numéro de téléphone est optionnel)
- Après la création, le flux d'ajout de dette continue immédiatement (pas de retour à l'écran précédent)
- Le nouveau client apparaît ensuite dans la liste des clients et dans les clients récents

### US-06 : Être bloqué à 10 clients et comprendre pourquoi

> En tant que **Mamadou (boutiquier en version gratuite)**, je veux **comprendre clairement pourquoi je ne peux pas ajouter de 11e client et comment débloquer cette limite** afin de **décider en connaissance de cause si le Premium vaut le coup**.

**Critères d'acceptation :**
- Lorsque le boutiquier tente d'ajouter un 11e client, un écran d'upgrade s'affiche (pas une simple erreur)
- L'écran compare clairement gratuit vs Premium
- Le prix est affiché avec un prix barré (~~5 000 FCFA~~ → 2 500 FCFA/mois)
- Le boutiquier peut payer directement via Wave ou Orange Money depuis cet écran
- Le boutiquier peut fermer cet écran et revenir à son utilisation normale (il n'est pas bloqué — ses 10 clients restent fonctionnels)

### US-07 : Envoyer un rappel WhatsApp à un client

> En tant que **Aïssatou (vendeuse de tissu, abonnée Premium)**, je veux **envoyer un rappel automatique à une cliente qui me doit de l'argent** afin de **récupérer mes créances sans avoir à la relancer moi-même en face-à-face**.

**Critères d'acceptation :**
- Un bouton "Envoyer un rappel" est visible sur la fiche client (uniquement pour les clients ayant un solde > 0 et un numéro de téléphone enregistré)
- En version gratuite, le bouton est visible mais grisé avec mention "Premium"
- Le message est pré-rédigé en français avec le prénom du client, le montant dû et le nom de la boutique
- Le boutiquier peut visualiser le message avant envoi
- Le message est envoyé via WhatsApp (ouverture de WhatsApp avec le message pré-rempli)
- Un indicateur sur la fiche client montre la date du dernier rappel envoyé

### US-08 : S'inscrire en 30 secondes

> En tant que **Ousmane (nouveau utilisateur)**, je veux **créer mon compte avec juste mon prénom et mon numéro de téléphone** afin de **commencer à utiliser l'application immédiatement sans friction**.

**Critères d'acceptation :**
- L'inscription demande uniquement : prénom + numéro de téléphone sénégalais
- Un code de vérification à 4-6 chiffres est envoyé par SMS
- Après saisie du code, le boutiquier arrive directement sur l'accueil (aucun tutoriel obligatoire, aucune étape de configuration)
- Le compte est créé et la session est persistante

---

## 6. Business Model & Monétisation

### Modèle : Freemium

Le boutiquier utilise Jurali gratuitement pour résoudre son problème de base (suivre les dettes de ses 10 premiers clients). La limite naturelle de clients le pousse vers le Premium quand son usage grandit.

### Tiers détaillés

| | **Gratuit** | **Premium** |
|---|---|---|
| **Prix** | 0 FCFA | ~~5 000 FCFA~~ → **2 500 FCFA/mois** |
| **Clients** | Jusqu'à 10 | Illimités |
| **Ajout de dettes** | ✅ Illimité | ✅ Illimité |
| **Enregistrement remboursements** | ✅ Illimité | ✅ Illimité |
| **Tableau de bord** | ✅ Complet | ✅ Complet |
| **Historique** | 30 derniers jours | Complet (sans limite) |
| **Rappels WhatsApp** | ❌ | ✅ Automatiques |
| **Sync multi-appareils** | ❌ | ✅ |
| **Export PDF/Excel** | ❌ | ✅ |

### Pourquoi cette limite de 10 clients fonctionne

Un boutiquier actif a facilement 30 à 50 clients débiteurs. Avec 10 clients gratuits, il peut :
- Tester le produit et voir la valeur immédiatement
- Créer l'habitude d'utilisation (2-3 semaines suffisent)
- Constater la douleur quand le 11e client demande du crédit et qu'il doit sortir le cahier papier pour celui-là

La friction est naturelle, pas artificielle.

### Moyens de paiement

| Moyen | Priorité |
|---|---|
| **Wave** | Obligatoire — moyen de paiement dominant chez les boutiquiers sénégalais |
| **Orange Money** | Obligatoire — deuxième moyen le plus utilisé |
| **Free Money** | Souhaitable (V1 ou V2) |
| **Carte bancaire** | Optionnel (< 5% de la cible utilise une carte) |

**Passerelle de paiement recommandée** : Moneroo (agrège Wave, Orange Money, Free Money et cartes en une seule intégration).

### Projections de revenus réalistes (scénario conservateur)

| Métrique | M3 | M6 | M12 |
|---|---|---|---|
| Utilisateurs inscrits | 300 | 1 500 | 5 000 |
| Utilisateurs actifs mensuels | 150 | 750 | 2 500 |
| Conversion Premium | 5% | 5% | 7% |
| Abonnés payants | 8 | 38 | 175 |
| Revenu mensuel | 20 000 FCFA | 95 000 FCFA | 437 500 FCFA |

---

## 7. Métriques de succès

### Métriques de lancement (90 premiers jours)

| KPI | Cible | Justification |
|---|---|---|
| **Inscriptions** | 300 en 90 jours | Acquisition terrain (3 boutiquiers de départ comme ambassadeurs, chacun en recrute 2-3 par mois via bouche-à-oreille + visites terrain) |
| **Taux d'activation J+1** | > 40% | Un boutiquier qui a enregistré au moins 1 dette dans les 24h suivant l'inscription est "activé". Le produit doit être assez simple pour ça. |
| **Taux de rétention J+7** | > 30% | Le boutiquier revient au moins 1 fois dans les 7 jours suivant l'inscription pour enregistrer une transaction. |
| **Dettes enregistrées par utilisateur actif par semaine** | > 5 | Prouve que le produit remplace le cahier dans le quotidien réel. |
| **Conversion gratuit → Premium** | 3-5% | Cible standard pour un freemium B2C à faible coût. Acceptable dès M2 (les utilisateurs ont besoin de 3-4 semaines pour atteindre la limite de 10 clients). |
| **Revenu mensuel récurrent (MRR)** | 20 000 FCFA à M3 | Preuve de willingness-to-pay, pas un objectif de rentabilité. |

### Métriques produit (en continu)

| KPI | Cible |
|---|---|
| **Temps pour enregistrer une dette (client existant)** | < 5 secondes |
| **Nombre moyen de clients par boutiquier actif** | > 8 (approche de la limite gratuite) |
| **Taux de complétion du flux d'onboarding** | > 80% |
| **NPS** | > 40 (bouche-à-oreille = canal d'acquisition principal) |

---

## 8. Ce qui est HORS SCOPE V1

| Feature exclue | Raison |
|---|---|
| **Gestion de stock / inventaire** | Ce n'est pas un outil de gestion de boutique. Jurali fait UNE chose : le suivi des crédits. Ajouter du stock = devenir Samabitik = perdre en simplicité. |
| **Paiement en ligne par le client** | Le client rembourse en cash ou via mobile money directement au boutiquier. Jurali n'est pas un intermédiaire de paiement. Trop de complexité réglementaire et technique pour le MVP. |
| **Multi-utilisateurs / rôles** | Un seul utilisateur par compte en V1. La gestion d'un associé avec des droits différents est une feature Premium V2. |
| **Rapports et analytics avancés** | Pas de graphiques, pas de tendances, pas de prédictions. Les 4 indicateurs de l'accueil suffisent pour le MVP. |
| **Version multilingue (wolof, pulaar, etc.)** | L'interface est en français uniquement en V1. Le wolof écrit n'est pas standardisé et les boutiquiers lettrés lisent le français. À revisiter en V2 avec des pictogrammes et de l'audio. |
| **Intégration comptable** | Pas de lien avec des logiciels de comptabilité. L'export PDF/Excel Premium est la seule passerelle. |
| **Mode hors-ligne complet** | Le concurrent "Carnet de Dettes" est 100% offline mais sans sync. Jurali est cloud-first. Les données se synchronisent quand le réseau est disponible, mais la V1 ne gère pas un mode offline complet avec résolution de conflits. Les pages déjà chargées restent consultables. |
| **Notifications push automatiques** | Pas de système de notifications automatiques "Vous avez 5 dettes de plus de 30 jours". Le rappel est déclenché manuellement par le boutiquier via le bouton WhatsApp. V2. |
| **App native (Play Store)** | Jurali est une application web responsive, accessible depuis le navigateur. Pas de développement natif Android/iOS en V1. Si la traction le justifie, un wrapper PWA "installable" pourra être ajouté. |

---

## 9. Risques et mitigation

### Risque 1 — Le boutiquier ne voit pas la valeur vs le cahier gratuit

**Probabilité** : Élevée
**Impact** : Critique (pas d'adoption = pas de produit)

Le cahier papier est gratuit, ne nécessite pas de batterie, et fonctionne depuis des décennies. Convaincre un boutiquier de changer d'habitude est le défi #1.

**Mitigation** :
- L'onboarding terrain est indispensable : aller physiquement chez les boutiquiers, leur montrer le produit, enregistrer leurs 5 premiers clients avec eux.
- Le produit doit montrer sa valeur en 48h : dès que le boutiquier voit le total de ses créances affiché en gros (un chiffre qu'il n'a JAMAIS vu sur son cahier), le "aha moment" est atteint.
- Les 3 boutiquiers déjà identifiés dans la validation terrain sont les premiers ambassadeurs — les transformer en "super-utilisateurs" qui montrent Jurali à leurs voisins commerçants.

### Risque 2 — Taux de conversion freemium → payant trop bas

**Probabilité** : Moyenne
**Impact** : Élevé (pas de revenus = pas de viabilité)

2 500 FCFA/mois n'est pas cher, mais payer un abonnement mensuel pour un outil digital est un comportement nouveau pour cette cible.

**Mitigation** :
- La limite de 10 clients est le levier principal. Si un boutiquier a 10 clients dans Jurali et un 11e arrive, il ne va pas retourner au cahier — il va payer.
- Les rappels WhatsApp sont la "killer feature" payante : si un seul rappel permet de récupérer 15 000 FCFA oubliés, l'abonnement à 2 500 FCFA se rembourse 6x.
- Offrir le premier mois gratuit en Premium aux 50 premiers utilisateurs pour créer l'habitude et les témoignages.

### Risque 3 — Les données sensibles (dettes) créent de la méfiance

**Probabilité** : Moyenne
**Impact** : Élevé

Un boutiquier qui confie la liste de ses débiteurs à une application peut craindre que ces données soient vues par d'autres, partagées, ou utilisées contre lui.

**Mitigation** :
- Message clair dans l'onboarding : "Vos données sont privées. Personne d'autre que vous ne peut les voir."
- Aucun partage de données entre commerçants (même si le même client apparaît chez deux boutiquiers, ils ne le savent pas).
- Connexion par code SMS = le boutiquier contrôle l'accès à son compte via son numéro personnel.

### Risque 4 — Connectivité insuffisante pour un outil cloud

**Probabilité** : Moyenne (Thiès, banlieue de Dakar = couverture 4G inégale)
**Impact** : Moyen

Si le boutiquier ne peut pas enregistrer une dette au moment où le client achète parce que le réseau est coupé, il retourne au cahier.

**Mitigation** :
- Pages ultra-légères : l'application doit fonctionner correctement sur une connexion 2G/3G lente.
- Enregistrement local temporaire : si le réseau est indisponible, la dette est enregistrée localement et synchronisée dès que le réseau revient (sans gestion de conflits complexe — c'est un usage mono-utilisateur en V1).
- La consultation des données déjà chargées doit fonctionner sans réseau.

### Risque 5 — Un concurrent mieux financé copie le produit

**Probabilité** : Faible à court terme, moyenne à 12 mois
**Impact** : Élevé

Si Jurali trouve son marché, un acteur comme Samabitik ou un nouvel entrant pourrait ajouter un module "carnet de crédit" à son offre.

**Mitigation** :
- La vitesse d'exécution est la meilleure défense : être le premier à installer l'habitude chez 1 000+ boutiquiers sénégalais.
- Le bouche-à-oreille terrain crée un fossé : chaque boutiquier qui recommande Jurali à un voisin renforce l'effet réseau local.
- V2 : ajouter des features qui augmentent le coût de switch (historique long, export, scoring crédit du client) pour verrouiller l'utilisateur.