#!/bin/bash
# Tests des statistiques : chiffres comparés à des requêtes SQL indépendantes, accès par rôle, dépense rattachée à une activité

# --- Réglages (voir tests/README.md) ---
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && (pwd -W 2>/dev/null || pwd))"
B="${BASE_URL:-http://localhost:8081}"
S="${TEST_TMP:-$HERE/.tmp}"; mkdir -p "$S"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Définir ADMIN_PASSWORD (mot de passe du compte admin de la base de TEST)}"
PSQL="${PSQL:-psql}"; : "${PGPASSWORD:?Définir PGPASSWORD (mot de passe PostgreSQL de la base de TEST)}"; export PGPASSWORD
DB_NAME="${DB_NAME:-mutuelle_v2}"; PGUSER="${PGUSER:-postgres}"; PGHOST="${PGHOST:-localhost}"
OUT="$S/out.json"
PASS=0; FAIL=0

check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  OK   $1 ($3)"; else FAIL=$((FAIL+1)); echo "  ÉCHEC $1 : attendu $2, obtenu $3  $(head -c 200 $OUT)"; fi; }
login() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/'; }
jget() { node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],d);console.log(v===undefined?'':v)" "$1"; }
call() { if [ -n "$4" ]; then curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$4" "$B$2"; else curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" "$B$2"; fi; }
sql() { "$PSQL" -h "$PGHOST" -U "$PGUSER" -d "$DB_NAME" -tAc "$1"; }
num() { node -e "console.log(Number(process.argv[1]))" "$1"; }

ADMIN=$(login admin "$ADMIN_PASSWORD"); SFX=$(date +%s | tail -c 6)
mk() { curl -s -o /dev/null -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"Test1234x\",\"firstName\":\"Prenom\",\"lastName\":\"N$1\",\"email\":\"$1@test.local\",\"phone\":\"+22670000000\",\"role\":\"$2\",\"etatCompte\":\"ACTIF\"}" $B/api/membres; }
mk s_m$SFX MEMBRE; mk s_c$SFX COMMISSAIRE; mk s_t$SFX TRESORIER
M=$(login s_m$SFX Test1234x); CO=$(login s_c$SFX Test1234x); TR=$(login s_t$SFX Test1234x)
YEAR=$(date +%Y)

echo "=== STATISTIQUES : chiffres comparés au SQL ==="
call GET "/api/stats/treasury?year=$YEAR" $ADMIN >/dev/null
check "solde de la caisse = entrées - sorties enregistrées" "$(num "$(sql "select coalesce(sum(case when sens='ENTREE' then montant else -montant end),0) from operations where statut='ENREGISTREE'")")" "$(jget soldeCaisse)"
check "entrées de l'année" "$(num "$(sql "select coalesce(sum(montant),0) from operations where statut='ENREGISTREE' and sens='ENTREE' and extract(year from date_op)=$YEAR")")" "$(jget totalEntrees)"
check "sorties de l'année" "$(num "$(sql "select coalesce(sum(montant),0) from operations where statut='ENREGISTREE' and sens='SORTIE' and extract(year from date_op)=$YEAR")")" "$(jget totalSorties)"
check "cotisations de l'année" "$(num "$(sql "select coalesce(sum(montant),0) from operations where statut='ENREGISTREE' and type_op='COTISATION' and extract(year from date_op)=$YEAR")")" "$(jget totalCotisations)"
check "remboursements reçus" "$(num "$(sql "select coalesce(sum(montant),0) from operations where statut='ENREGISTREE' and type_op='REMBOURSEMENT_PRET' and extract(year from date_op)=$YEAR")")" "$(jget totalRemboursements)"
check "prêts en cours" "$(sql "select count(*) from prets where statut='EN_COURS'")" "$(jget pretsEnCours)"
check "encours à rembourser" "$(num "$(sql "select coalesce(sum(montant_accorde - montant_rembourse),0) from prets where statut='EN_COURS'")")" "$(jget encoursPrets)"
check "échéances en retard" "$(sql "select count(*) from echeances e join prets p on p.id=e.pret_id where p.statut='EN_COURS' and e.date_echeance<current_date and e.montant_du-coalesce((select sum(r.montant) from remboursements r where r.echeance_id=e.id and r.statut='ENREGISTRE'),0)>0")" "$(jget echeancesEnRetard)"
check "dépenses en attente du président" "$(sql "select count(*) from operations where statut='EN_ATTENTE_CONFIRMATION' and sens='SORTIE'")" "$(jget depensesEnAttente)"
check "le solde de fin d'année = solde début + entrées - sorties" "$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(Number(d.soldeDebutAnnee)+Number(d.totalEntrees)-Number(d.totalSorties))")" "$(jget soldeFinAnnee)"
SOMME=$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d.monthlyCashflow.reduce((s,m)=>s+m.entrees,0))")
check "somme des 12 mois = total des entrées" "$(jget totalEntrees)" "$SOMME"
check "douze mois dans le graphique" 12 "$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d.monthlyCashflow.length)")"

call GET "/api/stats/membership?year=$YEAR" $ADMIN >/dev/null
check "membres actifs" "$(sql "select count(*) from membres where etat_compte='ACTIF'")" "$(jget membresActifs)"
check "total des comptes" "$(sql "select count(*) from membres")" "$(jget totalMembres)"
check "en attente de validation (inscrits + validés trésorerie)" "$(sql "select count(*) from membres where etat_compte in ('EN_ATTENTE','VALIDE_PAR_TRESORERIE')")" "$(jget membresEnAttente)"
check "manifestations planifiées de l'année" "$(sql "select count(*) from manifestations where statut='PLANIFIEE' and extract(year from date)=$YEAR")" "$(jget manifestationsPlanifiees)"
check "à jour + en retard = membres suivis" "$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d.repartitionRetards.reduce((s,x)=>s+x.value,0))")" "$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d.membresAJour+d.membresEnRetard)")"

echo "=== STATISTIQUES : accès par rôle ==="
check "membre : trésorerie interdite" 403 $(call GET "/api/stats/treasury?year=$YEAR" $M)
check "membre : statistiques des membres interdites" 403 $(call GET "/api/stats/membership?year=$YEAR" $M)
check "commissaire : trésorerie en lecture" 200 $(call GET "/api/stats/treasury?year=$YEAR" $CO)
check "trésorier : trésorerie" 200 $(call GET "/api/stats/treasury?year=$YEAR" $TR)
check "année absurde refusée" 400 $(call GET "/api/stats/treasury?year=1" $ADMIN)
check "année passée sans données : pas d'erreur" 200 $(call GET "/api/stats/treasury?year=2020" $ADMIN)
check "année passée : caisse de départ = caisse d'aujourd'hui" "$(sql "select coalesce(sum(case when sens='ENTREE' then montant else -montant end),0) from operations where statut='ENREGISTREE' and date_op < '2020-01-01'")" "$(num $(jget soldeDebutAnnee))"

echo "=== ÉCHÉANCIER : la somme des échéances est exactement le prêt ==="
check "prêts récents dont les échéances ne totalisent pas le montant" 0 "$(sql "select count(*) from prets p where p.id>15 and exists(select 1 from echeances e where e.pret_id=p.id) and (select sum(montant_du) from echeances e where e.pret_id=p.id)<>p.montant_accorde")"

echo "=== DÉPENSE RATTACHÉE À UNE ACTIVITÉ ==="
call GET "/api/stats/membership?year=$YEAR" $ADMIN >/dev/null; COUT0=$(jget depensesActivites)
MP=$(sql "select id from manifestations where statut='PLANIFIEE' limit 1"); MA=$(sql "select id from manifestations where statut='ANNULEE' limit 1")
check "dépense pour une activité planifiée" 200 $(call POST /api/operations/depenses $TR "{\"montant\":1000,\"modePaiement\":\"ESPECES\",\"objetType\":\"manifestation\",\"objetId\":$MP}")
if [ -n "$MA" ]; then check "dépense pour une activité annulée refusée" 409 $(call POST /api/operations/depenses $TR "{\"montant\":1000,\"modePaiement\":\"ESPECES\",\"objetType\":\"manifestation\",\"objetId\":$MA}"); else echo "  --   ignoré : aucune activité annulée dans cette base"; fi
check "dépense pour une activité inexistante refusée" 400 $(call POST /api/operations/depenses $TR "{\"montant\":1000,\"modePaiement\":\"ESPECES\",\"objetType\":\"manifestation\",\"objetId\":999999}")
call GET "/api/stats/membership?year=$YEAR" $ADMIN >/dev/null
check "coût des activités compté (+1000)" $((${COUT0%.*} + 1000)) "$(node -e "console.log(Math.round($(jget depensesActivites)))")"


echo "=== RAPPORTS (PDF, Excel, CSV) ==="
# rapport MODELE FORMAT [debut] [fin] : génère le rapport puis affiche le code HTTP du téléchargement (fichier dans $S/rap.FORMAT)
rapport() {
  local id
  id=$(curl -s -X POST $B/api/rapports/generer -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"periodeDebut\":\"${3:-$YEAR-01-01}\",\"periodeFin\":\"${4:-$YEAR-12-31}\",\"modele\":\"$1\",\"export\":{\"format\":\"$2\"}}" | sed -E 's/.*"id":([0-9]+).*/\1/')
  curl -s -o "$S/rap.$2" -w "%{http_code}" -H "Authorization: Bearer $ADMIN" $B/api/rapports/exports/$id/file
}
for m in JOURNAL COTISATIONS PRETS MEMBRES ACTIVITES ANNUEL; do
  check "rapport $m en PDF" 200 $(rapport $m PDF)
  check "rapport $m : c'est bien un PDF" '%PDF' "$(head -c 4 $S/rap.PDF)"
  check "rapport $m en Excel" 200 $(rapport $m XLSX)
  check "rapport $m : c'est bien un classeur Excel" 'PK' "$(head -c 2 $S/rap.XLSX)"
  check "rapport $m en CSV" 200 $(rapport $m CSV)
done
check "rapport sur une période vide : pas d'erreur" 200 $(rapport JOURNAL PDF 2019-01-01 2019-01-31)
check "début après la fin refusé" 400 $(call POST /api/rapports/generer $ADMIN '{"periodeDebut":"2026-05-01","periodeFin":"2026-01-01","modele":"JOURNAL"}')
check "modèle inconnu refusé" 400 $(call POST /api/rapports/generer $ADMIN '{"periodeDebut":"2026-01-01","periodeFin":"2026-12-31","modele":"BIDON"}')
check "un membre ne génère pas de rapport" 403 $(call POST /api/rapports/generer $M '{"periodeDebut":"2026-01-01","periodeFin":"2026-12-31","modele":"JOURNAL"}')
check "le commissaire peut générer un rapport" 200 $(call POST /api/rapports/generer $CO '{"periodeDebut":"2026-01-01","periodeFin":"2026-12-31","modele":"JOURNAL"}')

echo; echo "RÉSULTAT : $PASS réussis, $FAIL échecs"
