package com.madsi.backend.security;

import com.madsi.backend.common.Enums;
import com.madsi.backend.mail.EmailService;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.membres.MembreService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * « Mot de passe oublié » : un lien à usage unique, valable une heure, est envoyé par email.
 * La réponse de l'application est toujours la même, que le compte existe ou non (on ne révèle pas qui est inscrit).
 * Si la messagerie n'est pas configurée, l'administrateur peut réinitialiser le mot de passe depuis la fiche du membre.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MotDePasseOublieService {

    private static final int VALIDITE_MINUTES = 60;
    private static final int MAX_DEMANDES_PAR_HEURE = 3;
    private static final SecureRandom ALEA = new SecureRandom();

    private final MembreRepository membreRepo;
    private final MembreService membreService;
    private final ResetMotDePasseRepository resetRepo;
    private final EmailService emailService;

    @Value("${app.public-url:}") private String publicUrl;

    /** Demande de lien. Ne lève jamais d'exception visible (aucune information sur l'existence du compte). */
    @Transactional
    public void demander(String identifiant) {
        if (identifiant == null || identifiant.isBlank()) return;
        String id = identifiant.trim();
        Optional<Membre> opt = membreRepo.findByEmail(id.toLowerCase());
        if (opt.isEmpty()) opt = membreRepo.findByUsername(id);
        if (opt.isEmpty()) return;
        Membre m = opt.get();
        if (m.getEtatCompte() == Enums.EtatCompte.INACTIF) return;

        LocalDateTime maintenant = LocalDateTime.now();
        if (resetRepo.countByMembreIdAndCreeLeAfter(m.getId(), maintenant.minusHours(1)) >= MAX_DEMANDES_PAR_HEURE) {
            log.warn("Trop de demandes de réinitialisation pour le membre {}", m.getId());
            return;
        }
        if (!emailService.estConfigure()) {
            log.warn("Réinitialisation demandée par le membre {} mais la messagerie n'est pas configurée : "
                    + "l'administrateur peut réinitialiser le mot de passe depuis la fiche du membre.", m.getId());
            return;
        }

        byte[] octets = new byte[32];
        ALEA.nextBytes(octets);
        String jeton = Base64.getUrlEncoder().withoutPadding().encodeToString(octets);
        resetRepo.invaliderAnciens(m.getId());
        resetRepo.purger(maintenant.minusDays(1));
        resetRepo.save(ResetMotDePasse.builder()
                .membreId(m.getId()).empreinte(empreinte(jeton)).creeLe(maintenant)
                .expireLe(maintenant.plusMinutes(VALIDITE_MINUTES)).utilise(false).build());

        String base = (publicUrl == null || publicUrl.isBlank()) ? "" : publicUrl.trim().replaceAll("/+$", "");
        String lien = base + "/reinitialiser-mot-de-passe?jeton=" + jeton;
        String prenom = (m.getFirstName() == null || m.getFirstName().isBlank()) ? "" : " " + m.getFirstName();
        emailService.envoyerAsync(m.getId(), m.getEmail(), "Réinitialisation de votre mot de passe",
                "Réinitialisation du mot de passe",
                "Bonjour" + prenom + ",\n\nVous avez demandé à changer votre mot de passe. Ouvrez ce lien (valable " + VALIDITE_MINUTES
                        + " minutes, utilisable une seule fois) :\n" + lien
                        + "\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
                "MOT_DE_PASSE");
    }

    /** Applique le nouveau mot de passe si le lien est valable. */
    @Transactional
    public void reinitialiser(String jeton, String nouveauMotDePasse) {
        if (jeton == null || jeton.isBlank()) throw new IllegalArgumentException("Lien invalide ou expiré.");
        ResetMotDePasse r = resetRepo.findByEmpreinte(empreinte(jeton.trim()))
                .orElseThrow(() -> new IllegalArgumentException("Lien invalide ou expiré. Refaites une demande."));
        if (r.isUtilise() || r.getExpireLe().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Lien invalide ou expiré. Refaites une demande.");
        }
        membreService.definirMotDePasse(r.getMembreId(), nouveauMotDePasse); // vérifie la robustesse du mot de passe
        r.setUtilise(true);
        resetRepo.save(r);
    }

    private static String empreinte(String jeton) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(jeton.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
