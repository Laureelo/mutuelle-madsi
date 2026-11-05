#!/bin/bash
# Lance toutes les batteries de tests l'une après l'autre et affiche un résumé.
# Voir tests/README.md pour les réglages (ADMIN_PASSWORD, PGPASSWORD...) et la préparation de la base de TEST.
cd "$(dirname "$0")" || exit 1

SCRIPTS="test-roles test-flows test-preuves test-regles test-stats"
# Les tests d'emails demandent que l'application soit lancée avec la messagerie pointée vers le faux serveur SMTP (README).
[ -n "$AVEC_EMAILS" ] && SCRIPTS="$SCRIPTS test-emails"

TOTAL_OK=0; TOTAL_KO=0; ECHECS=""
for s in $SCRIPTS; do
  echo "=================== $s ==================="
  SORTIE="$(bash "$s.sh" 2>&1)"
  echo "$SORTIE" | grep -E "ÉCHEC|RÉSULTAT|ignoré"
  LIGNE="$(echo "$SORTIE" | grep "RÉSULTAT" | tail -1)"
  OK="$(echo "$LIGNE" | sed -E 's/.*: ([0-9]+) réussis.*/\1/')"; KO="$(echo "$LIGNE" | sed -E 's/.* ([0-9]+) échecs.*/\1/')"
  [[ "$OK" =~ ^[0-9]+$ ]] && TOTAL_OK=$((TOTAL_OK + OK)) || ECHECS="$ECHECS $s(plantage)"
  [[ "$KO" =~ ^[0-9]+$ ]] && TOTAL_KO=$((TOTAL_KO + KO))
  [ "$KO" != "0" ] && ECHECS="$ECHECS $s"
done
echo
echo "==================== RÉSUMÉ ===================="
echo "Réussis : $TOTAL_OK   Échecs : $TOTAL_KO"
[ -n "$ECHECS" ] && { echo "Batteries à regarder :$ECHECS"; exit 1; }
exit 0
