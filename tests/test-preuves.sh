#!/bin/bash
# Tests des preuves de paiement et de la photo de profil (backend V2 sur le port 8081)

# --- Réglages (voir tests/README.md) ---
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && (pwd -W 2>/dev/null || pwd))"
B="${BASE_URL:-http://localhost:8081}"
S="${TEST_TMP:-$HERE/.tmp}"; mkdir -p "$S"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Définir ADMIN_PASSWORD (mot de passe du compte admin de la base de TEST)}"
PSQL="${PSQL:-psql}"; : "${PGPASSWORD:?Définir PGPASSWORD (mot de passe PostgreSQL de la base de TEST)}"; export PGPASSWORD
DB_NAME="${DB_NAME:-mutuelle_v2}"; PGUSER="${PGUSER:-postgres}"; PGHOST="${PGHOST:-localhost}"
OUT="$S/out.json"
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  OK   $1 ($3)"; else FAIL=$((FAIL+1)); echo "  ÉCHEC $1 : attendu $2, obtenu $3  $(head -c 160 $OUT)"; fi; }
login() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/'; }
jget() { node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],d);console.log(v===undefined?'':v)" "$1"; }
call() { # call METHOD PATH TOKEN [FICHIER_CORPS]
  if [ -n "$4" ]; then curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" -H 'Content-Type: application/json' --data-binary @"$4" "$B$2"
  else curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" "$B$2"; fi; }

ADMIN=$(login admin "$ADMIN_PASSWORD")
SFX=$(date +%s)
mk() { curl -s -o /dev/null -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"Test1234x\",\"firstName\":\"Prenom\",\"lastName\":\"Nom$1\",\"email\":\"$1@test.local\",\"phone\":\"+22670000000\",\"role\":\"$2\",\"etatCompte\":\"ACTIF\"}" $B/api/membres; }
mk p_membre$SFX MEMBRE; mk p_autre$SFX MEMBRE; mk p_treso$SFX TRESORIER; mk p_commis$SFX COMMISSAIRE
MEMBRE=$(login p_membre$SFX Test1234x); AUTRE=$(login p_autre$SFX Test1234x); TRESO=$(login p_treso$SFX Test1234x); COMMIS=$(login p_commis$SFX Test1234x)

echo "=== Poids des listes (données réelles de la base de test) ==="
curl -s -o "$OUT" -H "Authorization: Bearer $TRESO" $B/api/cotisations/toutes
TAILLE=$(wc -c < "$OUT"); echo "     /api/cotisations/toutes : $TAILLE octets (13 669 730 avant correction)"
[ "$TAILLE" -lt 200000 ] && { PASS=$((PASS+1)); echo "  OK   liste de toutes les cotisations légère"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC liste trop lourde"; }
grep -q 'data:image' "$OUT" && { FAIL=$((FAIL+1)); echo "  ÉCHEC une image est encore dans la liste"; } || { PASS=$((PASS+1)); echo "  OK   aucune image dans la liste"; }
ANC=$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const x=d.find(c=>c.aPreuve);console.log(x?x.id:'')")
if [ -n "$ANC" ]; then
grep -q '"aPreuve":true' "$OUT" && { PASS=$((PASS+1)); echo "  OK   la liste indique aPreuve=true"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC aPreuve absent"; }
echo "     ancienne cotisation avec preuve : #$ANC"
check "chargement à la demande de l'ancienne preuve (trésorier)" 200 $(call GET /api/preuves/cotisations/$ANC $TRESO)
LEN=$(jget data | wc -c); [ "$LEN" -gt 1000 ] && { PASS=$((PASS+1)); echo "  OK   l'image revient bien ($LEN caractères)"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC image vide"; }
else echo "  --   ignoré : aucune ancienne preuve de paiement dans cette base"; fi

echo "=== Nouvelle preuve compressée ==="
node -e "
const fs=require('fs');
const img='data:image/jpeg;base64,'+'A'.repeat(150000);
fs.writeFileSync('$S/body1.json', JSON.stringify({moisDebut:'2027-01',nombreMois:1,modePaiement:'MOBILE_MONEY',reference:'TX-P1',photoPreuve:img}));
const gros='data:image/jpeg;base64,'+'A'.repeat(3100000);
fs.writeFileSync('$S/body2.json', JSON.stringify({moisDebut:'2027-02',nombreMois:1,modePaiement:'MOBILE_MONEY',reference:'TX-P2',photoPreuve:gros}));
fs.writeFileSync('$S/body3.json', JSON.stringify({firstName:'Prenom',lastName:'Nom',photoUrl:'data:image/jpeg;base64,'+'B'.repeat(30000),role:'ADMIN'}));
fs.writeFileSync('$S/body4.json', JSON.stringify({photoUrl:'data:image/jpeg;base64,'+'C'.repeat(20000)}));
"
check "déclaration avec preuve (150 Ko)" 200 $(call POST /api/cotisations/declarer $MEMBRE "$S/body1.json")
COT=$(jget id); echo "     réponse : aPreuve=$(jget aPreuve), photoPreuve présente dans la réponse ? '$(jget photoPreuve | head -c 20)'"
[ -z "$(jget photoPreuve)" ] && { PASS=$((PASS+1)); echo "  OK   la réponse ne renvoie pas l'image"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC image renvoyée"; }
check "propriétaire : charge sa preuve" 200 $(call GET /api/preuves/cotisations/$COT $MEMBRE)
check "autre membre : refusé" 403 $(call GET /api/preuves/cotisations/$COT $AUTRE)
check "trésorier : autorisé" 200 $(call GET /api/preuves/cotisations/$COT $TRESO)
check "commissaire : autorisé" 200 $(call GET /api/preuves/cotisations/$COT $COMMIS)
check "sans connexion : refusé" 401 $(curl -s -o "$OUT" -w "%{http_code}" $B/api/preuves/cotisations/$COT)
check "type inconnu -> 404" 404 $(call GET /api/preuves/inconnu/1 $TRESO)
check "image trop volumineuse (3 Mo) -> refusée" 400 $(call POST /api/cotisations/declarer $MEMBRE "$S/body2.json")

echo "=== Photo de profil ==="
check "mise à jour de la photo seule" 200 $(call PUT /api/profil/mon-profil $MEMBRE "$S/body4.json")
L=$(jget photoUrl | wc -c); [ "$L" -gt 19000 ] && { PASS=$((PASS+1)); echo "  OK   la vignette est enregistrée ($L caractères)"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC photo non enregistrée ($L)"; }
check "photo + tentative de prise du rôle ADMIN" 200 $(call PUT /api/profil/mon-profil $MEMBRE "$S/body3.json")
R=$(curl -s -H "Authorization: Bearer $MEMBRE" $B/api/profil/mon-profil | sed -E 's/.*"role":"([A-Z]+)".*/\1/'); [ "$R" = "MEMBRE" ] && { PASS=$((PASS+1)); echo "  OK   le rôle reste MEMBRE"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC rôle = $R"; }

echo
echo "RÉSULTAT : $PASS réussis, $FAIL échecs"
