#!/bin/bash
# Tests des règles du règlement intérieur : prêts, remboursements, dépenses, prestations (backend V2 port 8081)

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
has() { if grep -q "$2" "$OUT"; then PASS=$((PASS+1)); echo "  OK   $1"; else FAIL=$((FAIL+1)); echo "  ÉCHEC $1 : « $2 » absent de $(head -c 220 $OUT)"; fi; }
login() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/'; }
uid() { curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"$2\"}" | sed -E 's/.*"id":([0-9]+).*/\1/'; }
jget() { node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],d);console.log(v===undefined?'':v)" "$1"; }
call() { if [ -n "$4" ]; then curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$4" "$B$2"; else curl -s -o "$OUT" -w "%{http_code}" -X "$1" -H "Authorization: Bearer $3" "$B$2"; fi; }
sql() { "$PSQL" -h "$PGHOST" -U "$PGUSER" -d "$DB_NAME" -tAc "$1"; }
solde() { curl -s -H "Authorization: Bearer $TRESO" $B/api/operations/solde | sed -E 's/.*"soldeTotal":([0-9.-]+).*/\1/'; }

ADMIN=$(login admin "$ADMIN_PASSWORD"); SFX=$(date +%s | tail -c 6)
mk() { curl -s -o /dev/null -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "{\"username\":\"$1\",\"password\":\"Test1234x\",\"firstName\":\"Prenom\",\"lastName\":\"N$1\",\"email\":\"$1@test.local\",\"phone\":\"+22670000000\",\"role\":\"$2\",\"etatCompte\":\"ACTIF\"}" $B/api/membres; }
for n in a b c; do mk r_$n$SFX MEMBRE; done; mk r_t1$SFX TRESORIER; mk r_t2$SFX TRESORIER
A=$(login r_a$SFX Test1234x); BB=$(login r_b$SFX Test1234x); C=$(login r_c$SFX Test1234x); TRESO=$(login r_t1$SFX Test1234x); T2=$(login r_t2$SFX Test1234x)
IDA=$(uid r_a$SFX Test1234x); IDB=$(uid r_b$SFX Test1234x); IDC=$(uid r_c$SFX Test1234x); IDT1=$(uid r_t1$SFX Test1234x)

regle() { # regle true|false : active ou désactive « être à jour des cotisations » dans les Paramètres
  call GET /api/settings $ADMIN >/dev/null
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$OUT','utf8'));d.finance.exigerCotisationsAJour=$1;fs.writeFileSync('$S/settings2.json',JSON.stringify(d))"
  call PUT /api/settings $ADMIN "@$S/settings2.json" >/dev/null
}

echo "=== PARAMÈTRES : la règle « à jour des cotisations » est désactivée par défaut ==="
call POST /api/settings/reset $ADMIN >/dev/null
call GET /api/settings $ADMIN >/dev/null
if [ "$(jget finance.exigerCotisationsAJour)" = "false" ]; then PASS=$((PASS+1)); echo "  OK   par défaut : règle désactivée"; else FAIL=$((FAIL+1)); echo "  ÉCHEC valeur par défaut : '$(jget finance.exigerCotisationsAJour)'"; fi
echo "     seuil de confirmation=$(jget finance.seuilConfirmationDepense)  plafond d'encours=$(jget finance.plafondEncoursPrets)"
regle true
call GET /api/settings $ADMIN >/dev/null
if [ "$(jget finance.exigerCotisationsAJour)" = "true" ]; then PASS=$((PASS+1)); echo "  OK   règle activée pour les contrôles qui suivent"; else FAIL=$((FAIL+1)); echo "  ÉCHEC activation de la règle"; fi

echo "=== PRÊTS : plafond d'encours (50 000 FCFA) ==="
check "A demande 10 000 (aucun prêt en cours)" 200 $(call POST /api/prets $A "{\"membreId\":$IDA,\"montant\":10000,\"dureeMois\":2}")
PA1=$(jget id)
check "A demande 45 000 de plus (10 000 + 45 000 > 50 000) -> refusé" 409 $(call POST /api/prets $A "{\"membreId\":$IDA,\"montant\":45000,\"dureeMois\":3}")
has "message : plafond expliqué" "plafond"
check "A demande 40 000 de plus (total = 50 000) -> accepté" 200 $(call POST /api/prets $A "{\"membreId\":$IDA,\"montant\":40000,\"dureeMois\":4}")
check "A demande encore 1 000 (total 51 000) -> refusé" 409 $(call POST /api/prets $A "{\"membreId\":$IDA,\"montant\":1000,\"dureeMois\":1}")
check "montant négatif -> 400" 400 $(call POST /api/prets $BB "{\"membreId\":$IDB,\"montant\":-5,\"dureeMois\":2}")
check "B (aucun prêt) peut demander 60 000" 200 $(call POST /api/prets $BB "{\"membreId\":$IDB,\"montant\":60000,\"dureeMois\":3}")
PB=$(jget id); echo "     prêt de B : #$PB  confirmationRequise=$(jget confirmationRequise)"
check "B demande encore 100 -> refusé (il doit 60 000, plafond 50 000)" 409 $(call POST /api/prets $BB "{\"membreId\":$IDB,\"montant\":100,\"dureeMois\":1}")

echo "=== PRÊTS : confirmation du président au-dessus de 50 000 ==="
check "le trésorier valide 60 000 sans confirmation -> refusé" 409 $(call POST /api/prets/$PB/valider $TRESO)
has "message : président à confirmer" "président"
check "le trésorier ne peut pas confirmer lui-même" 403 $(call POST /api/prets/$PB/confirmer $TRESO)
check "un membre ne peut pas confirmer" 403 $(call POST /api/prets/$PB/confirmer $BB)
check "l'admin (président) confirme" 200 $(call POST /api/prets/$PB/confirmer $ADMIN)
echo "     confirme=$(jget confirme) confirmationRequise=$(jget confirmationRequise)"
check "confirmer un petit prêt (10 000) -> inutile, refusé" 409 $(call POST /api/prets/$PA1/confirmer $ADMIN)
check "le trésorier valide maintenant" 200 $(call POST /api/prets/$PB/valider $TRESO)
check "re-valider -> refusé (statut déjà APPROUVE)" 409 $(call POST /api/prets/$PB/valider $TRESO)
check "refuser un prêt déjà approuvé -> refusé" 409 $(call POST /api/prets/$PB/refuser $TRESO '{"motif":"x"}')
check "l'admin ne valide pas les prêts (séparation des pouvoirs)" 403 $(call POST /api/prets/$PA1/valider $ADMIN)

echo "=== PRÊTS : solde de caisse ==="
S0=$(solde); echo "     solde de la caisse : $S0"
check "verser 60 000 alors que la caisse a moins -> refusé" 409 $(call POST /api/prets/$PB/verser $TRESO '{"modePaiement":"ESPECES","reference":"V1","dateDecaissement":"2026-11-05"}')
has "message : solde insuffisant" "Solde de caisse insuffisant"
check "apport en caisse pour pouvoir verser 60 000" 200 $(call POST /api/caisse/apports $TRESO "{\"montant\":$((65000 - ${S0%.*})),\"modePaiement\":\"ESPECES\",\"reference\":\"APPORT-T\"}")
echo "     nouveau solde : $(solde)"
check "versement du prêt de B" 200 $(call POST /api/prets/$PB/verser $TRESO '{"modePaiement":"ESPECES","reference":"V1","dateDecaissement":"2026-11-05"}')
check "verser deux fois -> refusé" 409 $(call POST /api/prets/$PB/verser $TRESO '{"modePaiement":"ESPECES","reference":"V2","dateDecaissement":"2026-11-05"}')

echo "=== PRÊTS : un trésorier ne valide pas son propre prêt ==="
curl -s -o /dev/null -X POST -H "Authorization: Bearer $TRESO" -H 'Content-Type: application/json' -d "{\"membreId\":$IDT1,\"montant\":5000,\"dureeMois\":1}" $B/api/prets
check "T1 demande un prêt pour lui-même" 200 $(call POST /api/prets $TRESO "{\"membreId\":$IDT1,\"montant\":5000,\"dureeMois\":1}")
PT=$(jget id)
check "T1 valide son propre prêt -> refusé" 409 $(call POST /api/prets/$PT/valider $TRESO)
has "message : un autre trésorier" "un autre trésorier"
check "T2 (autre trésorier) valide" 200 $(call POST /api/prets/$PT/valider $T2)
check "T1 verse son propre prêt -> refusé" 409 $(call POST /api/prets/$PT/verser $TRESO '{"modePaiement":"ESPECES","reference":"VT","dateDecaissement":"2026-11-05"}')
check "T2 verse" 200 $(call POST /api/prets/$PT/verser $T2 '{"modePaiement":"ESPECES","reference":"VT","dateDecaissement":"2026-11-05"}')

echo "=== REMBOURSEMENTS : pas de surpaiement ==="
call GET /api/prets/$PB/echeancier $BB > /dev/null
E1=$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d[0].id)"); E2=$(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d[1].id)")
echo "     échéances du prêt de B : #$E1 et #$E2 (20 000 chacune)"
check "25 000 sur une échéance de 20 000 -> refusé" 409 $(call POST /api/remboursements $TRESO "{\"echeanceId\":$E1,\"montant\":25000,\"modePaiement\":\"ESPECES\"}")
has "message : reste dû" "reste dû"
check "montant nul -> 400" 400 $(call POST /api/remboursements $TRESO "{\"echeanceId\":$E1,\"montant\":0,\"modePaiement\":\"ESPECES\"}")
check "5 000 acceptés" 200 $(call POST /api/remboursements $TRESO "{\"echeanceId\":$E1,\"montant\":5000,\"modePaiement\":\"ESPECES\"}")
check "16 000 (reste 15 000) -> refusé" 409 $(call POST /api/remboursements $TRESO "{\"echeanceId\":$E1,\"montant\":16000,\"modePaiement\":\"ESPECES\"}")
check "15 000 : solde exact de l'échéance" 200 $(call POST /api/remboursements $TRESO "{\"echeanceId\":$E1,\"montant\":15000,\"modePaiement\":\"ESPECES\"}")
check "payer encore une échéance soldée -> refusé" 409 $(call POST /api/remboursements $TRESO "{\"echeanceId\":$E1,\"montant\":1,\"modePaiement\":\"ESPECES\"}")
has "message : déjà payée" "déjà entièrement payée"
echo "     reste dû de l'échéance 1 : $(call GET /api/echeances/$E1/solde $BB >/dev/null; jget reste)"
check "preuve mobile sur échéance soldée -> refusée" 409 $(call POST /api/remboursements/mobile/submit $BB "{\"echeanceId\":$E1,\"montant\":100,\"reference\":\"M1\"}")
check "preuve mobile de 30 000 (échéance 2 = 20 000) -> refusée" 409 $(call POST /api/remboursements/mobile/submit $BB "{\"echeanceId\":$E2,\"montant\":30000,\"reference\":\"M2\"}")
check "preuve mobile de 20 000 acceptée (en attente)" 200 $(call POST /api/remboursements/mobile/submit $BB "{\"echeanceId\":$E2,\"montant\":20000,\"reference\":\"M3\"}")
RM=$(jget id)
check "seconde preuve pour la même échéance -> refusée" 409 $(call POST /api/remboursements/mobile/submit $BB "{\"echeanceId\":$E2,\"montant\":100,\"reference\":\"M4\"}")
echo "     reste dû de l'échéance 2 (la preuve en attente ne compte pas) : $(call GET /api/echeances/$E2/solde $BB >/dev/null; jget reste)"
check "le trésorier valide la preuve mobile" 200 $(call POST /api/remboursements/$RM/valider $TRESO)
call GET /api/prets/$PB $BB > /dev/null; echo "     prêt de B : statut=$(jget statut) remboursé=$(jget montantRembourse) restant=$(jget montantRestant)"
check "remboursement sur prêt qui n'est plus EN_COURS ou soldé -> refusé" 409 $(call POST /api/remboursements $TRESO "{\"echeanceId\":$E2,\"montant\":1,\"modePaiement\":\"ESPECES\"}")

echo "=== DÉPENSES : confirmation du président au-dessus de 50 000 ==="
call POST /api/caisse/apports $TRESO '{"montant":100000,"modePaiement":"ESPECES","reference":"APPORT-D"}' > /dev/null
S1=$(solde)
check "dépense de 20 000 : immédiate avec reçu" 200 $(call POST /api/caisse/depenses $TRESO '{"montant":20000,"modePaiement":"ESPECES","reference":"D1"}')
[ -n "$(jget recuId)" ] && { PASS=$((PASS+1)); echo "  OK   un reçu est émis (enAttenteConfirmation=$(jget enAttenteConfirmation))"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC pas de reçu"; }
check "dépense de 60 000 : en attente de confirmation" 200 $(call POST /api/caisse/depenses $TRESO '{"montant":60000,"modePaiement":"ESPECES","reference":"D2"}')
OPD=$(jget operationId); echo "     enAttenteConfirmation=$(jget enAttenteConfirmation), recuId='$(jget recuId)'"
[ "$(jget enAttenteConfirmation)" = "true" ] && { PASS=$((PASS+1)); echo "  OK   marquée « en attente de confirmation »"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC pas en attente"; }
S2=$(solde); echo "     solde avant=$S1 après les 2 dépenses=$S2 (seuls les 20 000 sont sortis)"
check "le trésorier ne peut pas confirmer" 403 $(call POST /api/operations/$OPD/confirmer $TRESO)
check "l'admin (président) confirme" 200 $(call POST /api/operations/$OPD/confirmer $ADMIN)
[ -n "$(jget recuId)" ] && { PASS=$((PASS+1)); echo "  OK   le reçu est émis à la confirmation"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC pas de reçu à la confirmation"; }
echo "     solde après confirmation : $(solde)"
check "confirmer deux fois -> refusé" 409 $(call POST /api/operations/$OPD/confirmer $ADMIN)
call POST /api/caisse/depenses $TRESO '{"montant":70000,"modePaiement":"ESPECES","reference":"D3"}' > /dev/null; OPD3=$(jget operationId)
check "refus sans motif -> 400" 400 $(call POST /api/operations/$OPD3/refuser $ADMIN '{}')
check "refus avec motif" 200 $(call POST /api/operations/$OPD3/refuser $ADMIN '{"motif":"Hors budget"}')
call POST /api/caisse/depenses $TRESO '{"montant":900000,"modePaiement":"ESPECES","reference":"D4"}' > /dev/null; OPD4=$(jget operationId)
check "confirmer une dépense supérieure au solde -> refusé" 409 $(call POST /api/operations/$OPD4/confirmer $ADMIN)

echo "=== ANNULATION D'OPÉRATIONS ==="
call POST /api/caisse/depenses $TRESO '{"montant":1000,"modePaiement":"ESPECES","reference":"D5"}' > /dev/null; OPD5=$(jget operationId)
check "annulation sans motif -> 400" 400 $(call POST /api/operations/$OPD5/annuler $TRESO)
check "annulation avec motif" 200 $(call POST "/api/operations/$OPD5/annuler?motif=Erreur%20de%20saisie" $TRESO)
check "annuler deux fois -> refusé" 409 $(call POST "/api/operations/$OPD5/annuler?motif=x" $TRESO)
OPADH=$(sql "select id from operations where objet_type='adhesion' and statut='ENREGISTREE' limit 1")
check "annuler le paiement d'une adhésion -> refusé" 409 $(call POST "/api/operations/$OPADH/annuler?motif=x" $TRESO)
OPPRET=$(sql "select id from operations where objet_type='pret' and statut='ENREGISTREE' limit 1")
check "annuler le versement d'un prêt -> refusé" 409 $(call POST "/api/operations/$OPPRET/annuler?motif=x" $TRESO)

echo "=== TRÉSORIER : pas de validation de sa propre cotisation ==="
check "T1 déclare sa cotisation" 200 $(call POST /api/cotisations/declarer $TRESO '{"moisDebut":"2027-03","nombreMois":1,"modePaiement":"ESPECES"}')
CT=$(jget id)
check "T1 valide sa propre cotisation -> refusé" 409 $(call POST /api/cotisations/$CT/valider-cotisation $TRESO '{}')
check "T2 la valide" 200 $(call POST /api/cotisations/$CT/valider-cotisation $T2 '{}')
OPCOT=$(jget operationId)
check "annulation de l'encaissement d'une cotisation" 200 $(call POST "/api/operations/$OPCOT/annuler?motif=Doublon" $TRESO)
call GET /api/cotisations/$CT $TRESO > /dev/null; echo "     la cotisation annulée est maintenant : $(jget statut)"
[ "$(jget statut)" = "REJETE" ] && { PASS=$((PASS+1)); echo "  OK   elle redevient impayée"; } || { FAIL=$((FAIL+1)); echo "  ÉCHEC statut=$(jget statut)"; }

echo "=== À JOUR DES COTISATIONS (règlement art. 11 et 18) ==="
sql "update membres set date_adhesion='2026-01-10' where id=$IDC" >/dev/null
check "situation de C (arriérés depuis janvier)" 200 $(call GET /api/membres/$IDC/situation $C)
echo "     aJour=$(jget aJour), mois impayés: $(node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));console.log(d.moisImpayes.length+' ('+d.moisImpayes[0]+' ... '+d.moisImpayes[d.moisImpayes.length-1]+')')")"
check "C demande un prêt sans être à jour -> refusé" 409 $(call POST /api/prets $C "{\"membreId\":$IDC,\"montant\":5000,\"dureeMois\":1}")
has "message : pas à jour" "pas à jour"
check "un autre membre ne voit pas la situation de C" 403 $(call GET /api/membres/$IDC/situation $A)
check "C déclare 10 mois (2026-01 à 2026-10)" 200 $(call POST /api/cotisations/declarer $C '{"moisDebut":"2026-01","nombreMois":10,"modePaiement":"MOBILE_MONEY","reference":"TXC"}')
call GET /api/membres/$IDC/situation $C > /dev/null; echo "     aJour=$(jget aJour)"
check "C peut maintenant demander un prêt" 200 $(call POST /api/prets $C "{\"membreId\":$IDC,\"montant\":5000,\"dureeMois\":1}")

echo "=== PRESTATIONS : maladie (2 visites au plus, 2 semaines d'écart) ==="
TYPES=$(curl -s -H "Authorization: Bearer $TRESO" $B/api/types-activite)
T1ERE=$(echo "$TYPES" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.find(t=>t.type==='MALADIE').id)")
T2EME=$(echo "$TYPES" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.find(t=>t.type==='MALADIE').id)")
d() { node -e "const x=new Date();x.setDate(x.getDate()+$1);console.log(x.toISOString().slice(0,10))"; }
man() { call POST /api/manifestations $A "{\"membreId\":$IDA,\"typeActiviteId\":$1,\"libelle\":\"Visite $2\",\"date\":\"$(d $3)\"}" >/dev/null; jget id; }
M1=$(man $T1ERE 1 2); M2=$(man $T2EME 2 6); M3=$(man $T2EME 3 20); M4=$(man $T2EME 4 40)
check "1re visite validée" 200 $(call POST /api/manifestations/$M1/valider $TRESO)
check "2e visite 4 jours après (moins de 2 semaines) -> refusée" 409 $(call POST /api/manifestations/$M2/valider $TRESO)
has "message : 2 semaines" "2 semaines"
check "2e visite 18 jours après -> acceptée" 200 $(call POST /api/manifestations/$M3/valider $TRESO)
check "3e visite -> refusée (maximum 2)" 409 $(call POST /api/manifestations/$M4/valider $TRESO)
has "message : maximum" "maximum"
check "valider deux fois la même manifestation -> refusé" 409 $(call POST /api/manifestations/$M1/valider $TRESO)
sql "update membres set date_adhesion='2026-01-10' where id=$IDB" >/dev/null
call POST /api/manifestations $BB "{\"membreId\":$IDB,\"typeActiviteId\":$T1ERE,\"libelle\":\"Visite B\",\"date\":\"$(d 3)\"}" >/dev/null; MB=$(jget id)
check "prestation pour un membre pas à jour (B) -> refusée" 409 $(call POST /api/manifestations/$MB/valider $TRESO)
has "message : pas à jour" "pas à jour"
check "le bénéficiaire ne valide pas sa propre demande (T1)" 409 $(call POST /api/manifestations/$(call POST /api/manifestations $TRESO "{\"membreId\":$IDT1,\"typeActiviteId\":$T1ERE,\"libelle\":\"Visite T1\",\"date\":\"$(d 3)\"}" >/dev/null; jget id)/valider $TRESO)

echo "=== RÈGLE DÉSACTIVÉE (par défaut) : personne n'est bloqué, les impayés restent visibles ==="
regle false
check "B (arriérés) demande un prêt : accepté, la règle est désactivée" 200 $(call POST /api/prets $BB "{\"membreId\":$IDB,\"montant\":10000,\"dureeMois\":2}")
call GET /api/prets/membre/$IDB $TRESO >/dev/null
if node -e "const d=JSON.parse(require('fs').readFileSync('$OUT','utf8'));process.exit(d.some(p=>p.statut==='DEMANDE'&&p.moisImpayesMembre>0)?0:1)"; then PASS=$((PASS+1)); echo "  OK   la demande indique au trésorier le nombre de mois impayés du demandeur"; else FAIL=$((FAIL+1)); echo "  ÉCHEC pas d'indication d'impayés sur la demande"; fi
check "situation de B" 200 $(call GET /api/membres/$IDB/situation $BB)
echo "     B : $(jget nombreMoisImpayes) mois impayés = $(jget montantImpaye) FCFA ; règle exigée = $(jget cotisationsAJourExigees)"
if [ "$(jget cotisationsAJourExigees)" = "false" ] && [ "$(jget nombreMoisImpayes)" -gt 0 ]; then PASS=$((PASS+1)); echo "  OK   mois et montant dû affichés, sans blocage"; else FAIL=$((FAIL+1)); echo "  ÉCHEC situation"; fi
check "la prestation du même membre (B) est maintenant validée" 200 $(call POST /api/manifestations/$MB/valider $TRESO)
regle false

echo
echo "RÉSULTAT : $PASS réussis, $FAIL échecs"
