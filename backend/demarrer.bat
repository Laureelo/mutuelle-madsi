@echo off
rem Lance l'application MADSI (a lancer depuis ce dossier : il contient le fichier .env et le dossier data).
cd /d "%~dp0"
if not exist target\madsi.jar (
  echo Le programme n'est pas encore fabrique. Lancez d'abord :  mvnw.cmd -Pprod clean package -DskipTests
  pause
  exit /b 1
)
echo =====================================================
echo  MADSI Mutuelle - demarrage
echo  Ouvrez ensuite http://localhost:8080 dans votre navigateur
echo  (laissez cette fenetre ouverte : la fermer arrete l'application)
echo =====================================================
java -jar target\madsi.jar
pause
