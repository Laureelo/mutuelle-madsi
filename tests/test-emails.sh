#!/bin/bash
# Tests des emails et notifications : faux serveur SMTP local (port 2525) + backend démarré par restart-mail.sh

# --- Réglages (voir tests/README.md) ---
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && (pwd -W 2>/dev/null || pwd))"
B="${BASE_URL:-http://localhost:8081}"
S="${TEST_TMP:-$HERE/.tmp}"; mkdir -p "$S"
# Faux serveur SMTP local qui reçoit les emails envoyés par l'application (voir tests/README.md)
SINK_PORT="${SINK_PORT:-2525}"
node "$HERE/smtp-sink.js" "$SINK_PORT" "$S/mails.jsonl" > "$S/sink.log" 2>&1 &
SINK_PID=$!; trap 'kill $SINK_PID 2>/dev/null' EXIT; sleep 1
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Définir ADMIN_PASSWORD (mot de passe du compte admin de la base de TEST)}"
PSQL="${PSQL:-psql}"; : "${PGPASSWORD:?Définir PGPASSWORD (mot de passe PostgreSQL de la base de TEST)}"; export PGPASSWORD
DB_NAME="${DB_NAME:-mutuelle_v2}"; PGUSER="${PGUSER:-postgres}"; PGHOST="${PGHOST:-localhost}"
OUT="$S/out.json"; MAILS="$S/mails.jsonl"
PASS=0; FAIL=0

check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  OK   $1 ($3)"; else FAIL=$((FAIL+1)); echo "  ÉCHEC $1 : attendu $2, obtenu $3  $(head -c 200 $OUT)"; fi; }
login() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/'; }
uid() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"id":([0-9]+).*/\1/'; }
jget() { node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],d);console.log(v===undefined?'':v)" "$1"; }
call() { if [ -n "$4" ]; then curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$4" "$B$2"; else curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" "$B$2"; fi; }
anon() { curl -s -o "$OUT" -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d "$2" "$B$1"; }
sql() { "$PSQL" -h "$PGHOST" -U "$PGUSER" -d "$DB_NAME" -tAc "$1"; }
nbmails() { grep -c . "$MAILS" 2>/dev/null || echo 0; }
# nombre de mails dont le sujet contient $1 (et le destinataire $2, facultatif)
mails() { node -e "const l=require('fs').readFileSync('$MAILS','utf8').split('\n').filter(Boolean).map(JSON.parse);console.log(l.filter(m=>m.sujet.includes(process.argv[1])&&(!process.argv[2]||m.to.includes(process.argv[2]))).length)" "$1" "$2"; }
dernier() { node -e "const l=require('fs').readFileSync('$MAILS','utf8').split('\n').filter(Boolean).map(JSON.parse).filter(m=>m.sujet.includes(process.argv[1]));console.log(l.length?JSON.stringify(l[l.length-1]):'{}')" "$1" > "$OUT"; }
attendre() { sleep 3; }

: > "$MAILS"
ADMIN=$(login admin "$ADMIN_PASSWORD"); SFX=$(date +%s | tail -c 6)
mk() { curl -s -o /dev/null -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"Test1234x\",\"firstName\":\"Prenom\",\"lastName\":\"N$1\",\"email\":\"$1@test.local\",\"phone\":\"+22670000000\",\"role\":\"$2\",\"etatCompte\":\"ACTIF\"}" $B/api/membres; }
mk e_m$SFX MEMBRE; mk e_t$SFX TRESORIER; mk e_b$SFX TRESORIER
M=$(login e_m$SFX Test1234x); TR=$(login e_t$SFX Test1234x); BU=$(login e_b$SFX Test1234x)
IDM=$(uid e_m$SFX Test1234x); IDT=$(uid e_t$SFX Test1234x)

call GET /api/admin/email $ADMIN >/dev/null; ECH0=$(jget echecs7Jours)
echo "=== ÉTAT DE LA MESSAGERIE ==="
check "l'admin voit l'état des emails" 200 $(call GET /api/admin/email $ADMIN)
check "messagerie configurée" true "$(jget configure)"
check "messagerie active" true "$(jget actif)"
check "un trésorier ne voit pas la configuration" 403 $(call GET /api/admin/email $TR)
check "un membre ne voit pas la configuration" 403 $(call GET /api/admin/email $M)

echo "=== MESSAGE DE TEST ==="
AVANT=$(nbmails)
check "envoi du message de test" 200 $(call POST /api/admin/email/test $ADMIN '{}')
check "test réussi" true "$(jget ok)"
check "le message de test est arrivé" 1 "$(mails 'Message de test')"
dernier 'Message de test'
check "expéditeur configuré" true "$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT','utf8')).from.includes('mutuelle@test.local'))")"

echo "=== INSCRIPTION : email de bienvenue ==="
check "inscription d'un visiteur" 200 $(anon /api/auth/register "{\"firstName\":\"Awa\",\"lastName\":\"Test\",\"email\":\"awa$SFX@test.local\",\"phone\":\"+22671000000\",\"username\":\"awa$SFX\",\"password\":\"Motdepasse1\"}")
attendre
check "email de bienvenue reçu" 1 "$(mails 'Bienvenue' awa$SFX@test.local)"

echo "=== MOT DE PASSE OUBLIÉ ==="
check "demande (compte existant)" 200 $(anon /api/auth/mot-de-passe-oublie "{\"identifiant\":\"awa$SFX@test.local\"}")
M1=$(jget message)
attendre
check "email de réinitialisation reçu" 1 "$(mails 'Réinitialisation' awa$SFX@test.local)"
dernier 'Réinitialisation'
JETON=$(node -e "const m=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const x=(m.texte||'').match(/jeton=([A-Za-z0-9_-]+)/);console.log(x?x[1]:'')")
[ -n "$JETON" ] && { PASS=$((PASS+1)); echo "  OK   le lien contient un jeton (${#JETON} caractères)"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC pas de jeton dans le mail"; }
check "mot de passe trop faible refusé" 400 $(anon /api/auth/reinitialiser-mot-de-passe "{\"jeton\":\"$JETON\",\"motDePasse\":\"abc\"}")
check "jeton inventé refusé" 400 $(anon /api/auth/reinitialiser-mot-de-passe '{"jeton":"inventé123","motDePasse":"NouveauMdp1"}')
check "nouveau mot de passe accepté" 200 $(anon /api/auth/reinitialiser-mot-de-passe "{\"jeton\":\"$JETON\",\"motDePasse\":\"NouveauMdp1\"}")
check "le jeton ne sert qu'une fois" 400 $(anon /api/auth/reinitialiser-mot-de-passe "{\"jeton\":\"$JETON\",\"motDePasse\":\"Autre12345\"}")
check "l'ancien mot de passe ne marche plus" 401 $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"awa$SFX\",\"password\":\"Motdepasse1\"}")
check "le nouveau mot de passe fonctionne" 200 $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"awa$SFX\",\"password\":\"NouveauMdp1\"}")
AVANT=$(nbmails)
check "compte inexistant : même réponse" 200 $(anon /api/auth/mot-de-passe-oublie '{"identifiant":"personne-inconnue@test.local"}')
check "compte inexistant : message identique" "$M1" "$(jget message)"
attendre
check "compte inexistant : aucun email envoyé" "$AVANT" "$(nbmails)"
echo "     limite : 3 demandes par heure et par compte"
anon /api/auth/mot-de-passe-oublie "{\"identifiant\":\"awa$SFX\"}" >/dev/null; anon /api/auth/mot-de-passe-oublie "{\"identifiant\":\"awa$SFX\"}" >/dev/null; anon /api/auth/mot-de-passe-oublie "{\"identifiant\":\"awa$SFX\"}" >/dev/null; anon /api/auth/mot-de-passe-oublie "{\"identifiant\":\"awa$SFX\"}" >/dev/null
attendre
check "au plus 3 emails de réinitialisation par heure" 3 "$(mails 'Réinitialisation' awa$SFX@test.local)"

echo "=== RÉINITIALISATION PAR L'ADMINISTRATEUR ==="
check "l'admin réinitialise le mot de passe d'un membre" 200 $(call POST /api/membres/$IDM/reinitialiser-mot-de-passe $ADMIN)
PROV=$(jget motDePasseProvisoire)
check "le mot de passe provisoire fonctionne" 200 $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"e_m$SFX\",\"password\":\"$PROV\"}")
check "un trésorier ne peut pas le faire" 403 $(call POST /api/membres/$IDM/reinitialiser-mot-de-passe $TR)

echo "=== COTISATION : validation -> email au membre ==="
check "le membre déclare un mois" 200 $(call POST /api/cotisations/declarer $M '{"moisDebut":"2026-11","nombreMois":1,"modePaiement":"ESPECES","reference":"TX-MAIL"}')
COT=$(jget id)
check "le trésorier est prévenu dans l'application (sans email)" 1 "$(sql "select count(*) from notifications where destinataire_id=$IDT and sujet like 'Cotisation % valider'")"
check "le trésorier valide" 200 $(call POST /api/cotisations/$COT/valider-cotisation $TR)
attendre
check "email « Cotisation validée » reçu par le membre" 1 "$(mails 'Cotisation validée' e_m$SFX@test.local)"
check "notification dans l'application pour le membre" 1 "$(sql "select count(*) from notifications where destinataire_id=$IDM and sujet like 'Cotisation valid%'")"

echo "=== PRÊT > SEUIL : le président est prévenu ==="
check "le membre demande 60 000" 200 $(call POST /api/prets $M "{\"membreId\":$IDM,\"montant\":60000,\"dureeMois\":3}")
PRET=$(jget id)
attendre
check "email « à confirmer » reçu par chaque administrateur" "$(sql "select count(*) from membres where role='ADMIN' and etat_compte='ACTIF'")" "$(mails 'Prêt à confirmer')"
check "le trésorier est prévenu de la demande" 1 "$(mails 'Nouvelle demande de prêt' e_t$SFX@test.local)"
check "refus du prêt avec motif" 200 $(call POST /api/prets/$PRET/refuser $TR '{"motif":"Caisse insuffisante ce mois-ci"}')
attendre
check "le membre reçoit le refus par email" 1 "$(mails 'Votre demande de prêt est refusée' e_m$SFX@test.local)"

echo "=== CLOCHE : notifications dans l'application ==="
check "compteur de non lues du membre" 200 $(call GET "/api/notifications/unread-count?destinataireId=$IDM" $M)
NL=$(jget count)
[ "$NL" -ge 2 ] && { PASS=$((PASS+1)); echo "  OK   le membre a $NL notifications non lues"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC non lues = $NL"; }
check "liste des notifications" 200 $(call GET "/api/notifications?destinataireId=$IDM&page=0&size=5" $M)
NID=$(jget content.0.id)
check "on ne lit pas les notifications d'un autre" 403 $(call GET "/api/notifications?destinataireId=$IDM" $TR)
check "marquer une notification comme lue" 200 $(call POST /api/notifications/$NID/lu $M)
check "tout marquer comme lu" 200 $(call POST "/api/notifications/tout-lu?destinataireId=$IDM" $M)
call GET "/api/notifications/unread-count?destinataireId=$IDM" $M >/dev/null
check "plus aucune notification non lue" 0 "$(jget count)"
check "un autre ne peut pas tout marquer lu à ma place" 403 $(call POST "/api/notifications/tout-lu?destinataireId=$IDM" $TR)

echo "=== REFUS DES EMAILS DE RAPPEL ==="
sql "update membres set date_adhesion='2026-06-01' where id=$IDM" >/dev/null
check "le membre refuse les emails de rappel" 200 $(call PUT /api/profil/mon-profil $M '{"notificationsEmail":false}')
check "son profil le confirme" false "$(jget notificationsEmail)"
check "le rappel des cotisations est envoyé aux retardataires" 200 $(call POST /api/admin/email/rappels $ADMIN)
attendre
check "un retardataire qui refuse ne reçoit pas d'email" 0 "$(mails 'Rappel' e_m$SFX@test.local)"
check "mais il a la notification dans l'application" 1 "$(sql "select count(*) from notifications where destinataire_id=$IDM and sujet like 'Rappel%' and topic_type='COTISATION'")"
echo "     relancer les rappels ne crée pas de doublon"
AVANT=$(sql "select count(*) from notifications where sujet like 'Rappel%'")
call POST /api/admin/email/rappels $ADMIN >/dev/null
check "pas de doublon" "$AVANT" "$(sql "select count(*) from notifications where sujet like 'Rappel%'")"
check "un trésorier ne lance pas les rappels" 403 $(call POST /api/admin/email/rappels $TR)

echo "=== ENVOYER UNE INFORMATION AUX MEMBRES ==="
check "un membre ne peut pas envoyer d'annonce" 403 $(call POST /api/annonces $M '{"titre":"X","message":"Y","audience":"TOUS"}')
check "message vide refusé" 400 $(call POST /api/annonces $BU '{"titre":"","message":"","audience":"TOUS"}')
ACTIFS=$(sql "select count(*) from membres where etat_compte='ACTIF'")
AVANT=$(nbmails)
check "le bureau envoie une annonce à tous" 200 $(call POST /api/annonces $BU '{"titre":"Assemblee generale","message":"Assemblee generale samedi a 9 h.","audience":"TOUS","parEmail":true}')
check "tous les membres actifs sont destinataires" "$ACTIFS" "$(jget destinataires)"
sleep 6
check "un email par membre actif (sauf ceux qui n'ont pas d'adresse valide)" "$ACTIFS" "$(mails 'Assemblee generale')"
check "audience inconnue refusée" 400 $(call POST /api/annonces $BU '{"titre":"X","message":"Y","audience":"NIMPORTE"}')
check "annonce au bureau seulement" 200 $(call POST /api/annonces $BU '{"titre":"Reunion du bureau","message":"Jeudi 10 h.","audience":"BUREAU","parEmail":false}')

echo "=== SUIVI DES COTISATIONS IMPAYÉES (relances) ==="
check "le trésorier consulte les arriérés" 200 $(call GET /api/cotisations/arrieres $TR)
check "le bureau aussi" 200 $(call GET /api/cotisations/arrieres $BU)
check "un membre non" 403 $(call GET /api/cotisations/arrieres $M)
NB=$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(0)" 2>/dev/null)
call GET /api/cotisations/arrieres $TR >/dev/null
check "le total des arriérés = nombre de lignes" "$(jget totalMembres)" "$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d.membres.length)")"

echo "=== JOURNAL ET SANTÉ ==="
call GET /api/admin/email $ADMIN >/dev/null
check "emails envoyés comptés dans le journal" true "$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT','utf8')).envoyes7Jours>=10)")"
check "aucun nouvel échec d'envoi pendant ce test" 0 "$(($(jget echecs7Jours) - ${ECH0:-0}))"
check "santé : section emails" 200 $(call GET /api/admin/sante $ADMIN)
check "santé : messagerie active" true "$(jget emails.actif)"

echo "=== COUPURE DES EMAILS DANS LES PARAMÈTRES ==="
call GET /api/settings $ADMIN >/dev/null
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$OUT','utf8'));d.notifications.canalEmailEnabled=false;fs.writeFileSync('$S/settings3.json',JSON.stringify(d))"
check "l'admin coupe les emails" 200 $(call PUT /api/settings $ADMIN "@$S/settings3.json")
check "la messagerie est maintenant inactive" false "$(call GET /api/admin/email $ADMIN >/dev/null; jget actif)"
AVANT=$(nbmails)
call POST /api/annonces $BU '{"titre":"Annonce sans email","message":"Test.","audience":"BUREAU","parEmail":true}' >/dev/null
attendre
check "aucun email ne part" "$AVANT" "$(nbmails)"
check "la notification dans l'application est créée" 1 "$(sql "select count(*) from notifications where sujet='Annonce sans email' and destinataire_id=$IDT")"
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$S/settings3.json','utf8'));d.notifications.canalEmailEnabled=true;fs.writeFileSync('$S/settings3.json',JSON.stringify(d))"
call PUT /api/settings $ADMIN "@$S/settings3.json" >/dev/null

echo; echo "RÉSULTAT : $PASS réussis, $FAIL échecs"
