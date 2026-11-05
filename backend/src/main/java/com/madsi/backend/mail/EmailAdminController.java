package com.madsi.backend.mail;

import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.security.AccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Configuration des emails vue par l'administrateur : état, journal des échecs, message de test. */
@RestController
@RequestMapping("/api/admin/email")
@RequiredArgsConstructor
public class EmailAdminController {

    private final EmailService email;
    private final EmailLogRepository logRepo;
    private final MembreRepository membreRepo;
    private final AccessGuard guard;
    private final com.madsi.backend.notifications.RappelsPlanifies rappels;

    @GetMapping
    public Map<String, Object> etat() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("configure", email.estConfigure());
        out.put("autorise", email.sontAutorises());
        out.put("actif", email.estActif());
        out.put("expediteur", email.adresseExpediteur());
        LocalDateTime il7 = LocalDateTime.now().minusDays(7);
        out.put("envoyes7Jours", logRepo.countByStatutAndDateEnvoiAfter(EmailLog.ENVOYE, il7));
        out.put("echecs7Jours", logRepo.countByStatutAndDateEnvoiAfter(EmailLog.ECHEC, il7));
        out.put("derniersEchecs", logRepo.findTop5ByStatutOrderByDateEnvoiDesc(EmailLog.ECHEC).stream().map(l -> Map.of(
                "date", l.getDateEnvoi().toString(), "adresse", l.getAdresse(), "sujet", String.valueOf(l.getSujet()),
                "erreur", String.valueOf(l.getErreur()))).toList());
        return out;
    }

    /** Envoie un message de test à l'adresse de l'administrateur connecté (ou à celle indiquée). */
    @PostMapping("/test")
    public Map<String, Object> test(@RequestBody(required = false) Map<String, String> in) {
        if (!email.estConfigure()) {
            return Map.of("ok", false, "message", "La messagerie n'est pas configurée : renseignez MAIL_HOST, MAIL_USERNAME et "
                    + "MAIL_PASSWORD dans backend/.env puis redémarrez l'application.");
        }
        String adresse = in == null ? null : in.get("adresse");
        if (adresse == null || adresse.isBlank()) {
            adresse = membreRepo.findById(guard.currentMembreId()).map(m -> m.getEmail()).orElse(null);
        }
        String erreur = email.envoyerMaintenant(guard.currentMembreId(), adresse, "Message de test",
                "Message de test",
                "Si vous lisez ce message, l'envoi d'emails de la mutuelle fonctionne.\n\nVous recevrez désormais les notifications "
                        + "(cotisations, prêts, rappels) par email, selon les réglages de l'application.", "TEST");
        return erreur == null
                ? Map.of("ok", true, "message", "Message de test envoyé à " + adresse + ". Vérifiez votre boîte de réception (et les courriers indésirables).")
                : Map.of("ok", false, "message", "Échec de l'envoi : " + erreur);
    }

    /** Lance les rappels du jour (échéances, cotisations du mois) sans attendre 9 h, par exemple après un arrêt du serveur. Sans doublon. */
    @PostMapping("/rappels")
    public Map<String, Object> lancerRappels() {
        var jour = java.time.LocalDate.now();
        return Map.of("echeances", rappels.executerRappelsEcheances(jour), "cotisations", rappels.executerRappelCotisations(jour));
    }

    @GetMapping("/journal")
    public List<EmailLog> journal() {
        return logRepo.findTop20ByOrderByDateEnvoiDesc();
    }
}
