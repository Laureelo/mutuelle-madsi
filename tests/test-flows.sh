#!/bin/bash
# Tests des parcours métier (backend V2 sur le port 8081, base de test)
# --- Réglages (voir tests/README.md) ---
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && (pwd -W 2>/dev/null || pwd))"
B="${BASE_URL:-http://localhost:8081}"
S="${TEST_TMP:-$HERE/.tmp}"; mkdir -p "$S"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Définir ADMIN_PASSWORD (mot de passe du compte admin de la base de TEST)}"
PSQL="${PSQL:-psql}"; : "${PGPASSWORD:?Définir PGPASSWORD (mot de passe PostgreSQL de la base de TEST)}"; export PGPASSWORD
DB_NAME="${DB_NAME:-mutuelle_v2}"; PGUSER="${PGUSER:-postgres}"; PGHOST="${PGHOST:-localhost}"

PASS=0; FAIL=0
code() { local m=$1 p=$2 t=$3 b=$4
  if [ -n "$b" ]; then curl -s -o $S/out.json -w "%{http_code}" -X "$m" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b" "$B$p"
  else curl -s -o $S/out.json -w "%{http_code}" -X "$m" -H "Authorization: Bearer $t" "$B$p"; fi; }
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  OK   $1 ($3)"; else FAIL=$((FAIL+1)); echo "  ÉCHEC $1 : attendu $2, obtenu $3  $(head -c 160 $S/out.json)"; fi; }
jget() { node -e "const d=JSON.parse(require('fs').readFileSync('$S/out.json','utf8'));const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],d);console.log(v===undefined?'':v)" "$1"; }
login() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/'; }
uid() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"id":([0-9]+).*/\1/'; }

ADMIN=$(login admin "$ADMIN_PASSWORD")
mk() { code POST /api/membres $ADMIN "{\"username\":\"$1\",\"password\":\"Test1234x\",\"firstName\":\"Prenom$1\",\"lastName\":\"Nom$1\",\"email\":\"$1@test.local\",\"phone\":\"+22670000000\",\"role\":\"$2\",\"etatCompte\":\"$3\"}" >/dev/null; }
mk f_membre MEMBRE ACTIF; mk f_autre MEMBRE ACTIF; mk f_treso TRESORIER ACTIF; mk f_commis COMMISSAIRE ACTIF
MEMBRE=$(login f_membre Test1234x); AUTRE=$(login f_autre Test1234x); TRESO=$(login f_treso Test1234x); COMMIS=$(login f_commis Test1234x)
ID_MEMBRE=$(uid f_membre Test1234x)

echo "=== Paramètres : montants du règlement ==="
c=$(curl -s -o $S/out.json -w "%{http_code}" $B/api/settings/public); check "informations publiques sans connexion" 200 $c
echo "     contenu : $(cat $S/out.json)"
[ "$(jget montantCotisation)" = "1000" ] && { PASS=$((PASS+1)); echo "  OK   cotisation = 1000 FCFA (ancien défaut 5000 corrigé)"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC cotisation = $(jget montantCotisation)"; }
[ "$(jget montantAdhesion)" = "2000" ] && { PASS=$((PASS+1)); echo "  OK   adhésion = 2000 FCFA"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC adhésion = $(jget montantAdhesion)"; }

echo "=== Cotisation : déclaration -> validation -> reçu ==="
check "le membre déclare 3 mois" 200 $(code POST /api/cotisations/declarer $MEMBRE '{"moisDebut":"2026-11","nombreMois":3,"modePaiement":"MOBILE_MONEY","reference":"TX-FLOW-1"}')
COT=$(jget id); MONTANT=$(jget montant)
echo "     cotisation #$COT, montant déclaré = $MONTANT"
[ "$MONTANT" = "3000" ] || [ "$MONTANT" = "3000.00" ] && { PASS=$((PASS+1)); echo "  OK   montant = 3 x 1000"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC montant $MONTANT"; }
check "avant validation : pas de reçu (404)" 404 $(code GET /api/cotisations/$COT/recu $MEMBRE)
check "le trésorier valide" 200 $(code POST /api/cotisations/$COT/valider-cotisation $TRESO '{}')
OPID=$(jget operationId); echo "     opération #$OPID"
check "le reçu (JSON) existe" 200 $(code GET /api/cotisations/$COT/recu $MEMBRE)
echo "     numéro de reçu : $(jget numero)"
RID=$(jget id)
c=$(curl -s -o /tmp/recu.pdf -w "%{http_code} %{content_type}" -H "Authorization: Bearer $MEMBRE" $B/api/operations/$OPID/recu/pdf); check "le membre télécharge son reçu PDF" "200 application/pdf" "$c"
SIZE=$(wc -c < /tmp/recu.pdf); [ "$SIZE" -gt 800 ] && { PASS=$((PASS+1)); echo "  OK   PDF non vide ($SIZE octets)"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC PDF vide"; }
head -c 5 /tmp/recu.pdf | grep -q "%PDF" && { PASS=$((PASS+1)); echo "  OK   le fichier est bien un PDF"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC pas un PDF"; }
check "un autre membre ne peut PAS le télécharger" 403 $(code GET /api/operations/$OPID/recu/pdf $AUTRE)
check "le trésorier peut le télécharger" 200 $(code GET /api/operations/$OPID/recu/pdf $TRESO)
check "le commissaire peut le télécharger" 200 $(code GET /api/operations/$OPID/recu/pdf $COMMIS)
check "par identifiant de reçu" 200 $(code GET /api/recus/$RID/pdf $MEMBRE)
check "même période re-déclarée -> refusé (400)" 400 $(code POST /api/cotisations/declarer $MEMBRE '{"moisDebut":"2026-11","nombreMois":1,"modePaiement":"ESPECES"}')

echo "=== Historique existant : reçu créé à la demande ==="
# une opération de cotisation déjà validée dans les données d'origine, sans reçu
c=$(curl -s -o $S/out.json -w "%{http_code}" -H "Authorization: Bearer $TRESO" "$B/api/operations?typeOp=COTISATION&dateTo=2026-03-01&size=1&page=0"); check "liste des opérations" 200 $c
OLDOP=$(jget content.0.id); echo "     ancienne opération #$OLDOP"
if [ -n "$OLDOP" ]; then c=$(curl -s -o /tmp/old.pdf -w "%{http_code} %{content_type}" -H "Authorization: Bearer $TRESO" $B/api/operations/$OLDOP/recu/pdf); check "reçu généré à la demande pour une ancienne opération" "200 application/pdf" "$c"; else echo "  --   ignoré : aucune ancienne opération sans reçu dans cette base"; fi

echo "=== Adhésion : inscription -> déclaration -> validation -> reçu -> activation ==="
check "inscription publique" 200 $(curl -s -o $S/out.json -w "%{http_code}" -X POST $B/api/auth/register -H 'Content-Type: application/json' -d '{"firstName":"Nouvel","lastName":"Adherent","email":"nouvel.f@test.local","phone":"+22671000000","username":"f_nouveau","password":"Test1234x","fonction":"Agent"}')
echo "     message : $(jget message)"
NOUVEAU=$(login f_nouveau Test1234x); IDN=$(uid f_nouveau Test1234x)
check "le visiteur déclare son adhésion" 201 $(code POST /api/adhesions/declarer $NOUVEAU '{"modePaiement":"ESPECES","reference":"ADH-FLOW"}')
echo "     montant : $(jget adhesion.montant)"
ADH=$(jget adhesion.id)
check "le trésorier valide l'adhésion" 200 $(code POST /api/adhesions/$ADH/valider $TRESO)
c=$(code GET /api/adhesions/membre/$IDN $TRESO); OPADH=$(jget 0.operationId); echo "     opération d'adhésion #$OPADH"
c=$(curl -s -o /tmp/adh.pdf -w "%{http_code} %{content_type}" -H "Authorization: Bearer $NOUVEAU" $B/api/operations/$OPADH/recu/pdf); check "le nouvel adhérent télécharge son reçu d'adhésion" "200 application/pdf" "$c"
check "il est en attente d'activation : pas encore d'accès aux cotisations" 403 $(code GET /api/cotisations/mes-cotisations $NOUVEAU)
check "l'admin active le compte" 200 $(code POST /api/membres/$IDN/activer $ADMIN)
check "il accède maintenant aux cotisations" 200 $(code GET /api/cotisations/mes-cotisations $NOUVEAU)

echo
echo "RÉSULTAT : $PASS réussis, $FAIL échecs"
