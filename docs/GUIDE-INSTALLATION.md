# Guide d'installation et d'exploitation

Ce guide s'adresse à la personne qui installe l'application sur un ordinateur ou un serveur du service
(pas besoin d'être développeur). Comptez 30 à 45 minutes pour la première installation.

## 1. Ce qu'il faut installer (une seule fois)

| Programme | Version | Lien / remarque |
|---|---|---|
| **Java (JDK)** | 17 ou plus (testé avec 21) | https://adoptium.net : choisir « JDK », cocher « Set JAVA_HOME » à l'installation |
| **PostgreSQL** | 14 ou plus (testé avec 16) | https://www.postgresql.org/download/ : noter le **mot de passe** choisi pour l'utilisateur `postgres` |
| **Git** (pour télécharger) | : | https://git-scm.com : ou télécharger l'archive ZIP du dépôt sur GitHub |

*Node.js n'est **pas** à installer : il est téléchargé automatiquement pendant la fabrication du programme.*
*Une connexion Internet est nécessaire pour cette première fabrication.*

## 2. Récupérer l'application

```
git clone https://github.com/Laureelo/mutuelle-madsi.git
cd mutuelle-madsi
```

(ou « Code > Download ZIP » sur la page GitHub, puis décompresser.)

## 3. Créer la base de données

Avec **pgAdmin** : clic droit sur *Databases > Create > Database…*, nom : `mutuelle`.
Ou en ligne de commande : `createdb -U postgres mutuelle`.

Les tables sont créées automatiquement par l'application au premier démarrage.

*(Alternative avec Docker : copier `.env.example` en `.env` à la racine, choisir un mot de passe, puis `docker compose up -d`.)*

## 4. Régler la configuration

Dans le dossier `backend`, copier le fichier `.env.example` en `.env` et l'ouvrir avec le Bloc-notes :

```
DB_PASSWORD=le-mot-de-passe-de-votre-postgresql        (obligatoire)
```

Les autres lignes sont facultatives (nom de la base, port 8080, emails, adresse publique…) et expliquées dans le fichier.
**Le fichier `.env` contient des secrets : ne le publiez jamais** (il est ignoré par Git).

## 5. Fabriquer le programme

Dans le dossier `backend` (Windows, invite de commandes) :

```
mvnw.cmd -Pprod clean package -DskipTests
```

(Linux/macOS : `./mvnw -Pprod clean package -DskipTests`.) La première fois, cela télécharge beaucoup de fichiers : patientez
quelques minutes. À la fin, le fichier `backend/target/madsi.jar` contient **tout** (serveur + interface web).

## 6. Lancer

Dans le dossier `backend` : double-cliquer sur **`demarrer.bat`** (ou `java -jar target/madsi.jar`).
Attendre le message « Started MadsiBackendApplication », puis ouvrir **http://localhost:8080** dans le navigateur.

**Premier démarrage** : l'application crée deux comptes et écrit leurs mots de passe (générés au hasard) dans le fichier
`backend/data/identifiants-initiaux.txt` :

* **admin** : administrateur (le président) ;
* **tresorier** : trésorier.

Connectez-vous, **changez les deux mots de passe** (menu *Mon Profil*), puis **supprimez ce fichier**.
Ensuite l'administrateur crée les autres comptes (menu *Membres > Nouveau*) ou les agents s'inscrivent eux-mêmes
depuis la page de connexion (« Créer un compte ») et suivent le parcours d'adhésion.

Dans *Paramètres*, vérifiez le nom de la mutuelle, les montants et les seuils (valeurs du règlement intérieur par défaut).

## 7. Utilisation par plusieurs personnes (service, réseau local)

1. Installer et lancer l'application sur **un ordinateur du service qui reste allumé** (ou un serveur).
2. Autoriser le port **8080** dans le pare-feu Windows (*Pare-feu > Règles de trafic entrant > Nouvelle règle > Port 8080*).
3. Les agents ouvrent `http://adresse-de-l-ordinateur:8080` (ex. `http://192.168.1.10:8080`).
4. Dans `backend/.env`, renseigner `PUBLIC_URL=http://192.168.1.10:8080` : c'est l'adresse utilisée dans les liens des emails.
5. **Démarrage automatique** : *Planificateur de tâches Windows > Créer une tâche > Déclencheur « Au démarrage de l'ordinateur » →
   Action : démarrer le programme `C:\...\backend\demarrer.bat`* (« Exécuter même si l'utilisateur n'est pas connecté »).
6. Pour un accès depuis Internet, placez l'application derrière un serveur web avec **HTTPS** (Nginx, Caddy, IIS…) :
   ne l'exposez pas telle quelle.

### Sur téléphone (application installable)

L'interface s'adapte à tous les écrans : sur téléphone, le menu s'ouvre par le bouton ☰ et les tableaux deviennent des fiches.
Chaque membre peut aussi **installer MADSI comme une application** (icône sur l'écran d'accueil, ouverture en plein écran) :

* **Android (Chrome / Edge)** : ouvrir l'adresse de l'application, menu ⋮ > *Installer l'application* (ou *Ajouter à l'écran d'accueil*).
* **iPhone (Safari)** : bouton Partager > *Sur l'écran d'accueil*.

L'installation « complète » (service worker) n'est proposée par les navigateurs que si l'adresse est en **HTTPS** (ou sur `localhost`).
Sans HTTPS (simple adresse `http://192.168.x.x:8080`), le raccourci sur l'écran d'accueil fonctionne quand même, mais sans le mode application.
Les données (cotisations, prêts, caisse) ne sont **jamais** gardées dans le téléphone : il faut être connecté au serveur pour les consulter.

## 8. Les emails (Gmail), facultatif mais recommandé

Sans configuration, l'application fonctionne normalement : les notifications restent dans la **cloche** de l'application.
Pour envoyer aussi des emails (rappels de cotisation et d'échéance, validation d'un paiement, décision sur un prêt, mot de passe
oublié, informations du bureau) :

1. Créer un **compte Gmail dédié** à la mutuelle (ex. `mutuelle.madsi@gmail.com`) : pas une adresse personnelle.
2. Dans ce compte : *Gérer le compte Google > Sécurité > Validation en deux étapes* (l'activer), puis
   https://myaccount.google.com/apppasswords > créer un **mot de passe d'application** (16 caractères).
3. Dans `backend/.env`, décommenter et remplir :
   ```
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=mutuelle.madsi@gmail.com
   MAIL_PASSWORD=le-mot-de-passe-d-application-de-16-caracteres
   PUBLIC_URL=http://adresse-de-l-application:8080
   ```
4. Redémarrer l'application, puis *Paramètres > Emails et rappels > « Envoyer un message de test à mon adresse »*.
5. Dans *Paramètres*, mettre l'**email de contact** de la mutuelle : les réponses des membres y arriveront.

Limite de Gmail : environ 500 messages par jour, largement suffisant. *Santé du système* et *Paramètres* indiquent les emails envoyés
et les éventuels échecs. Les rappels automatiques partent chaque jour à 9 h tant que l'application est allumée.
Chaque membre peut refuser les emails de **rappel** dans son profil.

**WhatsApp** n'est jamais envoyé automatiquement : dans *Relances cotisations* et *Informer les membres*, un bouton ouvre WhatsApp
avec le message déjà écrit ; la personne chargée du suivi appuie elle-même sur « Envoyer ».

## 9. Sauvegardes : à ne pas négliger

Double-cliquer sur **`backend/sauvegarder.bat`** : il crée dans `backend/sauvegardes/` une copie de la base
(`mutuelle-AAAAMMJJ-HHMM.dump`) et des reçus (`uploads-….zip`), et supprime les copies de plus de 30 jours.

**Chaque nuit automatiquement** (à taper une fois dans une invite de commandes administrateur, en adaptant le chemin) :

```
schtasks /Create /SC DAILY /ST 22:00 /TN "Sauvegarde MADSI" /TR "C:\mutuelle-madsi\backend\sauvegarder.bat 30"
```

Copiez régulièrement le dossier `sauvegardes` sur une **clé USB ou un autre ordinateur** : une sauvegarde qui reste sur le même disque ne protège pas d'une panne du disque.
*Santé du système* (menu administrateur) affiche la date de la dernière sauvegarde et prévient au-delà de 7 jours.

**Restaurer** (si besoin) : arrêter l'application, puis
```
pg_restore -U postgres -d mutuelle --clean --if-exists backend\sauvegardes\mutuelle-AAAAMMJJ-HHMM.dump
```
et décompresser `uploads-….zip` dans `backend\uploads`.

## 10. Mettre à jour l'application

```
git pull
cd backend
mvnw.cmd -Pprod clean package -DskipTests
```
Faire une sauvegarde avant, arrêter l'ancienne version, relancer `demarrer.bat`. La base se met à jour toute seule.

## 11. Problèmes fréquents

| Symptôme | Cause probable et solution |
|---|---|
| « Password authentication failed » au démarrage | `DB_PASSWORD` incorrect dans `backend/.env` |
| « Connection refused » vers la base | PostgreSQL n'est pas démarré (services Windows > *postgresql-x64-16*) |
| « Port 8080 was already in use » | Une autre application utilise 8080 : mettre `SERVER_PORT=8090` dans `.env` |
| Page blanche ou « Cannot GET » | Le programme a été fabriqué sans le profil `-Pprod` : refaire l'étape 5 |
| Mot de passe administrateur perdu | S'il existe un autre administrateur : fiche du membre > *Réinitialiser le mot de passe*. Sinon, il faut une intervention directe dans la base de données (contacter la personne qui a installé l'application) |
| Les emails ne partent pas | *Paramètres > Emails* montre la raison de l'échec ; vérifier le mot de passe **d'application** Gmail |
| Compte bloqué après des erreurs de mot de passe | Attendre 15 minutes (protection contre les attaques) |
| Un membre ne reçoit pas le lien « mot de passe oublié » | Messagerie non configurée : l'administrateur réinitialise le mot de passe depuis la fiche du membre |

## 12. Vie privée et données

L'application stocke des données personnelles d'agents (noms, téléphones, emails, matricules, photos de preuves de paiement).
Limitez l'accès à l'ordinateur qui l'héberge, faites des sauvegardes chiffrées si elles quittent le service, et ne publiez jamais
`backend/.env`, `backend/data/`, `backend/uploads/` ni les fichiers `*.dump` (ils sont exclus de Git).
