#!/bin/bash
# Batterie de tests de la grille des droits (backend V2 sur le port 8081, base de test)
# --- Réglages (voir tests/README.md) ---
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && (pwd -W 2>/dev/null || pwd))"
B="${BASE_URL:-http://localhost:8081}"
S="${TEST_TMP:-$HERE/.tmp}"; mkdir -p "$S"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Définir ADMIN_PASSWORD (mot de passe du compte admin de la base de TEST)}"
PSQL="${PSQL:-psql}"; : "${PGPASSWORD:?Définir PGPASSWORD (mot de passe PostgreSQL de la base de TEST)}"; export PGPASSWORD
DB_NAME="${DB_NAME:-mutuelle_v2}"; PGUSER="${PGUSER:-postgres}"; PGHOST="${PGHOST:-localhost}"

PASS=0; FAIL=0

code() { # code METHOD PATH TOKEN [BODY]
  local m=$1 p=$2 t=$3 b=$4
  if [ -n "$b" ]; then
    curl -s -o $S/out.json -w "%{http_code}" -X "$m" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b" "$B$p"
  else
    curl -s -o $S/out.json -w "%{http_code}" -X "$m" -H "Authorization: Bearer $t" "$B$p"
  fi
}
check() { # check "libellé" attendu obtenu
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  OK   $1 ($3)"; else FAIL=$((FAIL+1)); echo "  ÉCHEC $1 : attendu $2, obtenu $3  $(head -c 140 $S/out.json)"; fi
}
login() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/'; }
idof() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$3\"}" | sed -E 's/.*"id":([0-9]+).*/\1/'; }

echo "=== Connexion ==="
ADMIN=$(login admin "$ADMIN_PASSWORD"); echo "admin token: ${#ADMIN} car."
c=$(curl -s -o $S/out.json -w "%{http_code}" -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"mauvais"}'); M1=$(cat $S/out.json | sed -E 's/.*"message":"([^"]*)".*/\1/')
check "mauvais mot de passe -> 401" 401 $c
c=$(curl -s -o $S/out.json -w "%{http_code}" -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"username":"inconnu_xyz","password":"mauvais"}'); M2=$(cat $S/out.json | sed -E 's/.*"message":"([^"]*)".*/\1/')
check "identifiant inconnu -> 401" 401 $c
[ "$M1" = "$M2" ] && { PASS=$((PASS+1)); echo "  OK   même message pour identifiant inconnu et mauvais mot de passe : « $M1 »"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC messages différents: $M1 / $M2"; }
c=$(curl -s -o /dev/null -w "%{http_code}" $B/api/membres); check "sans jeton -> 401 (et non 403)" 401 $c
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer abc.def.ghi" $B/api/membres); check "jeton invalide -> 401" 401 $c

echo "=== Création des comptes de test (par l'admin) ==="
mk() { # mk username role etat
  local body="{\"username\":\"$1\",\"password\":\"Test1234x\",\"firstName\":\"Test\",\"lastName\":\"$1\",\"email\":\"$1@test.local\",\"phone\":\"+22670000000\",\"role\":\"$2\",\"etatCompte\":\"$3\"}"
  code POST /api/membres $ADMIN "$body"
}
for spec in "t_membre MEMBRE ACTIF" "t_treso TRESORIER ACTIF" "t_commis COMMISSAIRE ACTIF" "t_visiteur VISITEUR VISITEUR" "t_admin2 ADMIN ACTIF" "t_attente MEMBRE VALIDE_PAR_TRESORERIE"; do
  set -- $spec; c=$(mk $1 $2 $3); echo "  création $1 ($2/$3) -> $c"
done
MEMBRE=$(login t_membre Test1234x); TRESO=$(login t_treso Test1234x)
COMMIS=$(login t_commis Test1234x); VISIT=$(login t_visiteur Test1234x); ATTENTE=$(login t_attente Test1234x)
ID_MEMBRE=$(idof t_membre x Test1234x); ID_ADMIN=$(idof admin x "$ADMIN_PASSWORD")
echo "  id t_membre=$ID_MEMBRE"

echo "=== VISITEUR (accès restreint) ==="
check "voir son profil" 200 $(code GET /api/profil/mon-profil $VISIT)
check "ses cotisations -> refusé" 403 $(code GET "/api/cotisations/mes-cotisations" $VISIT)
check "liste des manifestations -> refusé" 403 $(code GET "/api/manifestations" $VISIT)
check "demander un prêt -> refusé" 403 $(code POST /api/prets $VISIT '{"membreId":1,"montant":1000,"dureeMois":1}')
check "mes adhésions" 200 $(code GET /api/adhesions/me $VISIT)

echo "=== COMPTE VALIDÉ PAR LA TRÉSORERIE MAIS NON ACTIVÉ (traité comme visiteur) ==="
check "ses cotisations -> refusé" 403 $(code GET "/api/cotisations/mes-cotisations" $ATTENTE)
check "son profil" 200 $(code GET /api/profil/mon-profil $ATTENTE)

echo "=== MEMBRE ==="
check "liste des membres -> refusé" 403 $(code GET /api/membres $MEMBRE)
check "fiche d'un autre membre (admin) -> refusé" 403 $(code GET /api/membres/$ID_ADMIN $MEMBRE)
check "sa propre fiche" 200 $(code GET /api/membres/$ID_MEMBRE $MEMBRE)
check "toutes les cotisations -> refusé" 403 $(code GET /api/cotisations/toutes $MEMBRE)
check "tous les prêts -> refusé" 403 $(code GET /api/prets $MEMBRE)
check "prêts d'un autre membre -> refusé" 403 $(code GET /api/prets/membre/$ID_ADMIN $MEMBRE)
check "ses propres prêts" 200 $(code GET /api/prets/membre/$ID_MEMBRE $MEMBRE)
check "cotisations d'un autre -> refusé" 403 $(code GET "/api/cotisations?membreId=$ID_ADMIN" $MEMBRE)
check "déclarer une cotisation POUR un autre -> refusé" 403 $(code POST /api/cotisations/declarer $MEMBRE "{\"membreId\":$ID_ADMIN,\"moisDebut\":\"2026-11\",\"nombreMois\":1,\"modePaiement\":\"ESPECES\"}")
check "demander un prêt POUR un autre -> refusé" 403 $(code POST /api/prets $MEMBRE "{\"membreId\":$ID_ADMIN,\"montant\":1000,\"dureeMois\":1}")
check "supprimer un membre -> refusé" 403 $(code DELETE /api/membres/$ID_ADMIN $MEMBRE)
check "stats trésorerie -> refusé" 403 $(code GET /api/stats/treasury $MEMBRE)
check "journal des opérations -> refusé" 403 $(code GET /api/operations $MEMBRE)
check "notifications d'un autre -> refusé" 403 $(code GET "/api/notifications?destinataireId=$ID_ADMIN" $MEMBRE)
check "ses notifications" 200 $(code GET "/api/notifications?destinataireId=$ID_MEMBRE" $MEMBRE)
check "historique d'un autre -> refusé" 403 $(code GET "/api/historiques?membreId=$ID_ADMIN" $MEMBRE)
check "types d'activité (lecture)" 200 $(code GET /api/types-activite $MEMBRE)
check "créer un type d'activité -> refusé" 403 $(code POST /api/types-activite $MEMBRE '{"libelle":"x","type":"AUTRE","sousType":"x","montantAlloue":1}')
check "paramètres (lecture)" 200 $(code GET /api/settings $MEMBRE)
check "modifier les paramètres -> refusé" 403 $(code PUT /api/settings $MEMBRE '{}')
check "remettre les paramètres à zéro -> refusé" 403 $(code POST /api/settings/reset $MEMBRE)
echo "  -- tentative de prise de rôle ADMIN via le profil --"
check "modifier son profil" 200 $(code PUT /api/profil/mon-profil $MEMBRE '{"firstName":"Test","lastName":"t_membre","role":"ADMIN","etatCompte":"ACTIF"}')
R=$(curl -s -H "Authorization: Bearer $MEMBRE" $B/api/profil/mon-profil | sed -E 's/.*"role":"([A-Z]+)".*/\1/')
[ "$R" = "MEMBRE" ] && { PASS=$((PASS+1)); echo "  OK   le rôle reste MEMBRE après la tentative"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC le rôle est devenu $R !"; }

echo "=== Le rôle BUREAU n'existe plus (droits portés par l'administrateur et les trésoriers) ==="
check "créer un compte BUREAU -> refusé" 400 $(code POST /api/membres $ADMIN "{\"username\":\"t_ancien_bureau\",\"password\":\"Test1234x\",\"firstName\":\"A\",\"lastName\":\"B\",\"email\":\"t_ancien_bureau@test.local\",\"role\":\"BUREAU\"}")
check "un trésorier voit la liste des membres" 200 $(code GET /api/membres $TRESO)
check "un trésorier voit les stats d adhésion" 200 $(code GET /api/stats/membership $TRESO)

echo "     message : $(sed -E 's/.*"message":"([^"]*)".*/\1/' $S/out.json)"

echo "=== Changement de rôle appliqué immédiatement ==="
mk t_rg TRESORIER ACTIF >/dev/null; RG=$(login t_rg Test1234x); ID_RG=$(idof t_rg x Test1234x)
check "t_rg (trésorier) voit la liste des membres" 200 $(code GET /api/membres $RG)
check "admin rétrograde t_rg en MEMBRE" 200 $(code POST /api/membres/$ID_RG/role $ADMIN '{"role":"MEMBRE"}')
check "t_rg (même jeton) n'a plus accès -> 403" 403 $(code GET /api/membres $RG)

echo "=== Limitation des tentatives (5 échecs) ==="
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"username":"cible_test","password":"x"}'; done
c=$(curl -s -o $S/out.json -w "%{http_code}" -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"username":"cible_test","password":"x"}')
check "6e tentative -> 429" 429 $c
echo "     message : $(sed -E 's/.*"message":"([^"]*)".*/\1/' $S/out.json)"

echo
echo "RÉSULTAT : $PASS réussis, $FAIL échecs"
