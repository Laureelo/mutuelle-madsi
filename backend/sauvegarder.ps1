# Sauvegarde de la mutuelle MADSI : copie de la base de données + des reçus et pièces jointes.
#
# Utilisation : double-cliquer sur sauvegarder.bat (ou le planifier chaque nuit, voir le guide d'installation).
# Les réglages (mot de passe de la base...) sont lus dans le fichier ".env" de ce dossier.
# Les copies sont déposées dans le dossier "sauvegardes" (ou BACKUP_DIR) ; celles de plus de 30 jours sont supprimées.

param([int]$Jours = 30)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

# --- Lecture des réglages : variables du système d'abord, puis fichier .env ---
$cfg = @{}
if (Test-Path '.env') {
    foreach ($ligne in Get-Content '.env' -Encoding UTF8) {
        if ($ligne -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and -not $ligne.TrimStart().StartsWith('#')) {
            $cfg[$Matches[1]] = $Matches[2]
        }
    }
}
function Reglage([string]$nom, [string]$defaut) {
    $v = [Environment]::GetEnvironmentVariable($nom)
    if ($v) { return $v }
    if ($cfg.ContainsKey($nom) -and $cfg[$nom]) { return $cfg[$nom] }
    return $defaut
}

$hote = Reglage 'DB_HOST' 'localhost'
$port = Reglage 'DB_PORT' '5432'
$base = Reglage 'DB_NAME' 'mutuelle'
$utilisateur = Reglage 'DB_USERNAME' 'postgres'
$motDePasse = Reglage 'DB_PASSWORD' ''
$dossier = Reglage 'BACKUP_DIR' '.\sauvegardes'

if (-not $motDePasse) {
    Write-Host "ERREUR : DB_PASSWORD est introuvable. Renseignez-le dans le fichier backend\.env." -ForegroundColor Red
    exit 1
}

# --- Recherche de pg_dump (installé avec PostgreSQL) ---
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
    $pgDump = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pgDump) {
    Write-Host "ERREUR : pg_dump est introuvable. Vérifiez que PostgreSQL est installé (dossier C:\Program Files\PostgreSQL)." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $dossier | Out-Null
$horodatage = Get-Date -Format 'yyyyMMdd-HHmm'
$fichierBase = Join-Path $dossier "$base-$horodatage.dump"

# --- 1) La base de données ---
$env:PGPASSWORD = $motDePasse
try {
    & $pgDump -h $hote -p $port -U $utilisateur -F c -f $fichierBase $base
    if ($LASTEXITCODE -ne 0) { throw "pg_dump a échoué (code $LASTEXITCODE)" }
} catch {
    if (Test-Path $fichierBase) { Remove-Item $fichierBase -Force }
    Write-Host "ERREUR : la sauvegarde de la base a échoué. $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
Write-Host ("Base sauvegardée : {0} ({1:N1} Mo)" -f $fichierBase, ((Get-Item $fichierBase).Length / 1MB))

# --- 2) Les reçus PDF et pièces jointes ---
if (Test-Path 'uploads') {
    $fichierUploads = Join-Path $dossier "uploads-$horodatage.zip"
    Compress-Archive -Path 'uploads\*' -DestinationPath $fichierUploads -Force
    Write-Host ("Reçus et pièces jointes sauvegardés : {0}" -f $fichierUploads)
}

# --- 3) Nettoyage des anciennes copies ---
$limite = (Get-Date).AddDays(-$Jours)
$anciennes = Get-ChildItem $dossier -File | Where-Object { $_.LastWriteTime -lt $limite -and $_.Name -match '\.(dump|zip)$' }
foreach ($f in $anciennes) { Remove-Item $f.FullName -Force }
if ($anciennes) { Write-Host ("{0} ancienne(s) copie(s) de plus de {1} jours supprimée(s)." -f @($anciennes).Count, $Jours) }

Write-Host "Sauvegarde terminée." -ForegroundColor Green
Write-Host "Conseil : copiez régulièrement le dossier '$dossier' sur une clé USB ou un autre ordinateur."
