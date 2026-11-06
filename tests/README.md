# Tests automatiques de l'application

Ces scripts pilotent l'application **déjà lancée** par de vrais appels HTTP (connexion, déclaration d'une cotisation,
demande de prêt, validation par le trésorier, etc.) et vérifient le résultat, souvent en le comparant à des requêtes SQL
indépendantes. Ils couvrent :

| Script | Ce qu'il vérifie |
|---|---|
| `test-roles.sh` | La grille des droits : qui peut faire quoi (membre, trésorier, commissaire, administrateur, visiteur), refus des accès aux données d'autrui, protection des comptes d'administration |
| `test-flows.sh` | Les parcours complets : cotisation > validation > reçu PDF, adhésion > validation > activation |
| `test-preuves.sh` | Les preuves de paiement (photos) et la photo de profil |
| `test-regles.sh` | Les règles du règlement intérieur : plafond de prêts, solde de caisse, confirmation du président, remboursements sans surpaiement, maladie, annulations, option « à jour des cotisations » |
| `test-stats.sh` | Les statistiques comparées au SQL, l'accès par rôle, l'échéancier, les dépenses rattachées aux activités |
| `test-emails.sh` | Les emails et notifications (avec un faux serveur SMTP local), mot de passe oublié, annonces, rappels |

## À lire avant de lancer

* **N'utilisez JAMAIS ces tests sur la base de données réelle.** Ils créent des comptes, des prêts, des dépenses…
  Créez une base **de test** (ex. `createdb mutuelle_test`) et lancez l'application dessus.
* Chaque exécution laisse des données dans la base de test. Pour rejouer, **repartez d'une base neuve** (supprimez-la et recréez-la).
* Il faut : un terminal `bash` (Git Bash sous Windows), `curl`, `node` (version 18 ou plus) et `psql` (installé avec PostgreSQL).

## Préparer et lancer

1. Créer la base de test et lancer l'application dessus (depuis le dossier `backend`) :

   ```bash
   createdb -U postgres mutuelle_test
   DB_PASSWORD=<mot de passe postgres> DB_NAME=mutuelle_test SERVER_PORT=8081 java -jar target/madsi.jar
   ```

   Au premier démarrage, l'identifiant et le mot de passe de l'administrateur sont écrits dans `backend/data/identifiants-initiaux.txt`.

2. Dans un second terminal, depuis le dossier `tests` :

   ```bash
   export ADMIN_PASSWORD=<mot de passe du compte admin de la base de test>
   export PGPASSWORD=<mot de passe postgres>
   export DB_NAME=mutuelle_test
   # export PSQL="C:/Program Files/PostgreSQL/16/bin/psql.exe"   # si psql n'est pas dans le PATH (Windows)
   # export BASE_URL=http://localhost:8081                        # adresse de l'application (par défaut)
   bash lancer-tout.sh
   ```

   Pour lancer une seule batterie : `bash test-regles.sh`.

3. **Tests d'emails** (facultatif) : lancez l'application avec la messagerie pointée vers le faux serveur SMTP que le test démarre
   lui-même sur le port 2525, puis `AVEC_EMAILS=1 bash lancer-tout.sh` :

   ```bash
   DB_PASSWORD=... DB_NAME=mutuelle_test SERVER_PORT=8081 \
   MAIL_HOST=127.0.0.1 MAIL_PORT=2525 MAIL_AUTH=false MAIL_STARTTLS=false \
   MAIL_FROM=mutuelle@test.local PUBLIC_URL=http://localhost:8081 java -jar target/madsi.jar
   ```

Un script affiche `OK` pour chaque vérification réussie, `ÉCHEC` (avec ce qui était attendu et obtenu) sinon, et un
résumé `RÉSULTAT : N réussis, M échecs` à la fin. Certaines vérifications portant sur d'anciennes données (reçus
d'anciennes opérations, anciennes preuves de paiement) sont affichées « ignoré » sur une base neuve : c'est normal.
