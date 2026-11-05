#!/bin/bash
# Sauvegarde de la mutuelle MADSI (Linux / macOS) : base de données + reçus et pièces jointes.
# Les réglages sont lus dans backend/.env (ou dans les variables d'environnement).
# Les copies de plus de 30 jours sont supprimées. Planification : voir le guide d'installation (cron).
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  while IFS='=' read -r cle valeur; do
    case "$cle" in ''|\#*) continue ;; esac
    [ -z "${!cle:-}" ] && export "$cle=$valeur"
  done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env)
fi

HOTE="${DB_HOST:-localhost}"; PORT="${DB_PORT:-5432}"; BASE="${DB_NAME:-mutuelle}"
UTILISATEUR="${DB_USERNAME:-postgres}"; DOSSIER="${BACKUP_DIR:-./sauvegardes}"; JOURS="${1:-30}"
[ -n "${DB_PASSWORD:-}" ] || { echo "ERREUR : DB_PASSWORD est introuvable (fichier backend/.env)." >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "ERREUR : pg_dump est introuvable (installez le client PostgreSQL)." >&2; exit 1; }

mkdir -p "$DOSSIER"
HORODATAGE="$(date +%Y%m%d-%H%M)"
FICHIER="$DOSSIER/$BASE-$HORODATAGE.dump"

if ! PGPASSWORD="$DB_PASSWORD" pg_dump -h "$HOTE" -p "$PORT" -U "$UTILISATEUR" -F c -f "$FICHIER" "$BASE"; then
  rm -f "$FICHIER"; echo "ERREUR : la sauvegarde de la base a échoué." >&2; exit 1
fi
echo "Base sauvegardée : $FICHIER"

if [ -d uploads ]; then
  tar -czf "$DOSSIER/uploads-$HORODATAGE.tar.gz" uploads
  echo "Reçus et pièces jointes sauvegardés : $DOSSIER/uploads-$HORODATAGE.tar.gz"
fi

find "$DOSSIER" -type f \( -name '*.dump' -o -name '*.zip' -o -name '*.tar.gz' \) -mtime "+$JOURS" -delete
echo "Sauvegarde terminée."
