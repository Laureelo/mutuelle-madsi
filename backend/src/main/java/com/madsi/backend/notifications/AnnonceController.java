package com.madsi.backend.notifications;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.EligibiliteService;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.membres.RoleMembre;
import com.madsi.backend.mail.EmailService;
import com.madsi.backend.security.AccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * « Envoyer une information aux membres » (trésorier, administrateur) : le message apparaît dans la cloche
 * de chaque destinataire et, si la messagerie est active, lui parvient par email.
 * Pour WhatsApp, l'écran propose de copier le message ou d'ouvrir WhatsApp (envoi manuel).
 */
@RestController
@RequestMapping("/api/annonces")
@RequiredArgsConstructor
public class AnnonceController {

    private static final Set<RoleMembre> BUREAU_ET_TRESORERIE = Set.of(RoleMembre.TRESORIER, RoleMembre.ADMIN);

    private final NotificationService notifications;
    private final MembreRepository membreRepo;
    private final EligibiliteService eligibilite;
    private final EmailService emailService;
    private final AccessGuard guard;

    public record AnnonceInput(String titre, String message, String audience, Boolean parEmail) {}

    @PostMapping
    public Map<String, Object> envoyer(@RequestBody AnnonceInput in) {
        String titre = in.titre() == null ? "" : in.titre().trim();
        String message = in.message() == null ? "" : in.message().trim();
        if (titre.isEmpty() || message.isEmpty()) throw new IllegalArgumentException("Le titre et le message sont obligatoires.");
        if (titre.length() > 150) throw new IllegalArgumentException("Le titre est trop long (150 caractères au plus).");
        if (message.length() > 2000) throw new IllegalArgumentException("Le message est trop long (2 000 caractères au plus).");

        String audience = in.audience() == null ? "TOUS" : in.audience();
        boolean email = Boolean.TRUE.equals(in.parEmail());
        String signature = "\n\n— " + notifications.nomDe(guard.currentMembreId());
        String texte = message + signature;

        int envoyes = 0;
        switch (audience) {
            case "TOUS" -> {
                for (Membre m : membreRepo.findByEtatCompte(Enums.EtatCompte.ACTIF)) {
                    if (notifications.informer(m.getId(), Enums.NotifType.INFO, titre, texte, Enums.TopicType.AUTRE, null, email) != null) envoyes++;
                }
            }
            case "BUREAU" -> envoyes = notifications.informerRoles(BUREAU_ET_TRESORERIE, Enums.NotifType.INFO, titre, texte,
                    Enums.TopicType.AUTRE, null, email);
            case "EN_RETARD" -> {
                for (var a : eligibilite.arrieres()) {
                    if (notifications.informer(a.membreId(), Enums.NotifType.INFO, titre, texte, Enums.TopicType.AUTRE, null, email) != null) envoyes++;
                }
            }
            default -> throw new IllegalArgumentException("Destinataires inconnus : " + audience);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("destinataires", envoyes);
        out.put("emailsActifs", emailService.estActif());
        out.put("emailDemande", email);
        return out;
    }
}
