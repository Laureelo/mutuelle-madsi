# MADSI

Application web de gestion de la mutuelle des agents de la DGSI (Burkina Faso). Elle couvre les adhésions, les cotisations,
les prêts sans intérêt, les prestations sociales, la caisse, les reçus et les statistiques, selon le règlement intérieur de la mutuelle.

Technologies : Java 17 et Spring Boot 3.5 pour le serveur, PostgreSQL pour les données, Angular 19 pour l'interface.
L'interface est livrée dans le même fichier que le serveur : il n'y a qu'un seul programme à lancer. Elle s'adapte aux ordinateurs
et aux téléphones, et peut être installée comme une application. Aucun service externe n'est obligatoire : l'envoi d'emails
(Gmail ou autre) est facultatif.

## Documentation

* [Guide d'installation](docs/GUIDE-INSTALLATION.md) : installer, configurer et exploiter l'application.
* [Guide d'utilisation](docs/Guide-utilisation-MADSI.docx) : fonctionnement et usage au quotidien (document Word de 4 pages).

## Fonctions

| Domaine | Contenu |
|---|---|
| Adhésion | Inscription en ligne, paiement du droit (2 000 FCFA), validation par le trésorier, activation par l'administrateur, reçu PDF |
| Cotisations | Déclaration par le membre (1 à 12 mois, photo de la preuve), validation ou rejet par le trésorier, reçu PDF, suivi des mois impayés |
| Prêts | Demande, confirmation du président au-dessus du seuil, validation, versement, calendrier de remboursement, reçus |
| Prestations et activités | Mariage, naissance, maladie, retraite, décès, sport, culture : déclaration, validation et paiement rattaché à l'activité |
| Caisse | Journal des opérations, solde à une date, confirmation du président pour les grosses dépenses, annulation encadrée |
| Suivi | Tableau de bord, statistiques, relances des retardataires (message WhatsApp envoyé manuellement), informations aux membres |
| Rapports | Journal de caisse, cotisations, prêts et remboursements, membres, activités, bilan annuel, en PDF, Excel ou CSV |
| Communication | Notifications dans l'application, emails automatiques si la messagerie est configurée, mot de passe oublié |
| Administration | Paramètres de la mutuelle, comptes et rôles, santé du système, sauvegardes |

## Rôles

Un compte a un seul rôle, et chaque rôle comprend les droits d'un membre. Il n'existe pas de rôle « bureau » distinct : le bureau est
formé du président (administrateur) et des trésoriers, qui disposent de tous les droits de suivi (membres, relances, informations).
Un changement de rôle s'applique immédiatement.

| Rôle | Pouvoirs principaux |
|---|---|
| Visiteur | Vient de s'inscrire : peut seulement déclarer son adhésion |
| Membre | Cotisations, prêts, prestations, profil, notifications |
| Trésorier | Valide les cotisations, adhésions, remboursements et versements, tient la caisse, produit les rapports, suit les membres. Ne valide pas ses propres opérations |
| Commissaire aux comptes | Lecture seule des finances |
| Administrateur (le président) | Gère les comptes, les rôles et les paramètres, confirme les dépenses et prêts au-dessus du seuil. Ne valide pas les paiements |

## Règles du règlement intérieur appliquées

* Droit d'adhésion de 2 000 FCFA et cotisation de 1 000 FCFA par mois, modifiables dans les paramètres.
* Prêts sans intérêt, versés seulement si la caisse est suffisante.
* Ce que le membre doit encore, ajouté au nouveau prêt, ne peut pas dépasser le plafond (50 000 FCFA, réglable).
* Au-dessus du seuil de confirmation (50 000 FCFA, réglable), un prêt ou une dépense est d'abord confirmé par le président.
* Un remboursement ne dépasse jamais le reste dû d'une échéance.
* La règle « à jour des cotisations » est désactivée par défaut et se règle dans les paramètres. Les mois impayés restent toujours visibles.
* Deux visites au plus par maladie, espacées d'au moins deux semaines.
* Un reçu PDF numéroté est généré pour toute somme versée.

Deux interprétations sont à faire valider par la mutuelle : le calcul du plafond des prêts et la durée de 90 jours qui permet de
considérer deux visites comme relevant de la même maladie.

## Sécurité

* Mots de passe chiffrés (BCrypt), connexion par jeton signé, blocage de 15 minutes après 5 échecs.
* Aucun secret dans le code : les mots de passe et clés sont dans `backend/.env` (non publié) ou générés au premier démarrage.
* Chaque donnée est protégée côté serveur selon le rôle, et un membre ne voit que ses propres données.
* Lien de réinitialisation du mot de passe à usage unique, valable une heure.

## Sauvegarde

`backend/sauvegarder.bat` (Windows) ou `sauvegarder.sh` (Linux) copie la base de données et les reçus. L'écran « Santé du système »
indique la date de la dernière sauvegarde. Le guide d'installation explique comment la planifier chaque nuit.

## Tests automatiques

Le dossier [tests](tests/README.md) contient plus de 230 vérifications automatiques (droits, parcours, règles du règlement,
statistiques comparées au SQL, emails). Elles se lancent sur une base de test, jamais sur la base réelle.

## Organisation du dépôt

```
backend/    serveur (Spring Boot), code dans src/main/java/com/madsi/backend
frontend/   interface web (Angular)
docs/       guide d'installation et guide d'utilisation
tests/      tests automatiques
docker-compose.yml   base PostgreSQL prête à l'emploi (facultatif)
```
