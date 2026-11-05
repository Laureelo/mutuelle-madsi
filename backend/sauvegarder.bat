@echo off
rem Sauvegarde de la mutuelle MADSI (base de donnees + recus). Voir le guide d'installation.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sauvegarder.ps1" %*
if errorlevel 1 (
  echo.
  echo La sauvegarde a echoue. Lisez le message ci-dessus.
)
if "%1"=="" pause
