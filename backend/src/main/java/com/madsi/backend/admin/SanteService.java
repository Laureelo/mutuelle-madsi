package com.madsi.backend.admin;

import com.madsi.backend.mail.EmailLog;
import com.madsi.backend.mail.EmailLogRepository;
import com.madsi.backend.mail.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * « Santé du système » : un coup d'œil pour l'administrateur (l'application tourne-t-elle bien ?
 * la base répond-elle ? reste-t-il de la place ? les sauvegardes sont-elles à jour ?).
 * Lecture seule : rien n'est modifié.
 */
@Service
public class SanteService {

    /** Au-delà de ce nombre de jours sans sauvegarde, on prévient l'administrateur. */
    private static final int SAUVEGARDE_TROP_ANCIENNE_JOURS = 7;

    private final JdbcTemplate jdbc;
    private final EmailService emailService;
    private final EmailLogRepository emailLog;
    private final File dossierSauvegardes;

    public SanteService(JdbcTemplate jdbc, EmailService emailService, EmailLogRepository emailLog,
                        @Value("${app.backup.dir:./sauvegardes}") String dossier) {
        this.jdbc = jdbc;
        this.emailService = emailService;
        this.emailLog = emailLog;
        this.dossierSauvegardes = new File(dossier);
    }

    public Map<String, Object> etat() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("heureServeur", LocalDateTime.now().toString());
        out.put("application", application());
        out.put("baseDeDonnees", baseDeDonnees());
        out.put("disque", disque());
        out.put("sauvegarde", sauvegarde());
        out.put("emails", emails());
        out.put("donnees", donnees());
        return out;
    }

    private Map<String, Object> application() {
        Map<String, Object> m = new LinkedHashMap<>();
        long ms = ManagementFactory.getRuntimeMXBean().getUptime();
        m.put("enMarcheDepuisSecondes", ms / 1000);
        m.put("demarreLe", LocalDateTime.ofInstant(Instant.now().minusMillis(ms), ZoneId.systemDefault()).toString());
        m.put("java", System.getProperty("java.version"));
        Runtime rt = Runtime.getRuntime();
        m.put("memoireUtiliseeMo", (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024));
        m.put("memoireMaxMo", rt.maxMemory() / (1024 * 1024));
        return m;
    }

    private Map<String, Object> baseDeDonnees() {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            long debut = System.nanoTime();
            jdbc.queryForObject("SELECT 1", Integer.class);
            m.put("ok", true);
            m.put("tempsReponseMs", Duration.ofNanos(System.nanoTime() - debut).toMillis());
            m.put("version", jdbc.queryForObject("SHOW server_version", String.class));
            Long taille = jdbc.queryForObject("SELECT pg_database_size(current_database())", Long.class);
            m.put("tailleMo", taille == null ? 0 : taille / (1024 * 1024));
        } catch (Exception e) {
            m.put("ok", false);
            m.put("erreur", "La base de données ne répond pas : " + e.getMessage());
        }
        return m;
    }

    private Map<String, Object> disque() {
        File racine = new File(".").getAbsoluteFile();
        long libre = racine.getUsableSpace();
        long total = racine.getTotalSpace();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("libreGo", Math.round(libre / 1_073_741_824.0 * 10) / 10.0);
        m.put("totalGo", Math.round(total / 1_073_741_824.0 * 10) / 10.0);
        m.put("pourcentageLibre", total == 0 ? null : Math.round(100.0 * libre / total));
        m.put("alerte", total > 0 && libre < 1_073_741_824L); // moins de 1 Go
        return m;
    }

    private Map<String, Object> sauvegarde() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("dossier", dossierSauvegardes.getAbsoluteFile().toPath().normalize().toString());
        File[] fichiers = dossierSauvegardes.listFiles((d, nom) -> nom.endsWith(".dump") || nom.endsWith(".sql"));
        if (fichiers == null || fichiers.length == 0) {
            m.put("derniere", null);
            m.put("nombre", 0);
            m.put("alerte", true);
            m.put("message", "Aucune sauvegarde trouvée. Lancez sauvegarder.bat (voir le guide d'installation).");
            return m;
        }
        File dernier = Arrays.stream(fichiers).max(Comparator.comparingLong(File::lastModified)).get();
        LocalDateTime date = LocalDateTime.ofInstant(Instant.ofEpochMilli(dernier.lastModified()), ZoneId.systemDefault());
        long jours = Duration.between(date, LocalDateTime.now()).toDays();
        m.put("derniere", date.toString());
        m.put("fichier", dernier.getName());
        m.put("tailleMo", Math.round(dernier.length() / 1024.0 / 1024.0 * 10) / 10.0);
        m.put("nombre", fichiers.length);
        m.put("alerte", jours >= SAUVEGARDE_TROP_ANCIENNE_JOURS);
        if (jours >= SAUVEGARDE_TROP_ANCIENNE_JOURS) {
            m.put("message", "La dernière sauvegarde date de " + jours + " jours : pensez à en refaire une.");
        }
        return m;
    }

    private Map<String, Object> emails() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("configure", emailService.estConfigure());
        m.put("actif", emailService.estActif());
        LocalDateTime il7 = LocalDateTime.now().minusDays(7);
        long envoyes = emailLog.countByStatutAndDateEnvoiAfter(EmailLog.ENVOYE, il7);
        long echecs = emailLog.countByStatutAndDateEnvoiAfter(EmailLog.ECHEC, il7);
        m.put("envoyes7Jours", envoyes);
        m.put("echecs7Jours", echecs);
        m.put("alerte", emailService.estConfigure() && echecs > 0 && echecs >= envoyes);
        var dernier = emailLog.findTop5ByStatutOrderByDateEnvoiDesc(EmailLog.ECHEC);
        m.put("derniereErreur", dernier.isEmpty() ? null : dernier.get(0).getErreur());
        return m;
    }

    private Map<String, Object> donnees() {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            m.put("membresActifs", jdbc.queryForObject("SELECT COUNT(*) FROM membres WHERE etat_compte = 'ACTIF'", Long.class));
            m.put("operations", jdbc.queryForObject("SELECT COUNT(*) FROM operations", Long.class));
            m.put("recus", jdbc.queryForObject("SELECT COUNT(*) FROM recus", Long.class));
        } catch (Exception e) {
            // la section « base de données » signale déjà le problème
        }
        return m;
    }
}
