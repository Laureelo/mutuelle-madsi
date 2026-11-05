package com.madsi.backend.notifications;

import com.madsi.backend.common.Enums.*;
import com.madsi.backend.mail.EmailService;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.membres.RoleMembre;
import com.madsi.backend.notifications.repo.NotificationRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collection;

/**
 * Informer un membre : une notification dans l'application (la « cloche »), et, si la messagerie est configurée,
 * un email. Il n'y a PAS d'envoi automatique de WhatsApp : le trésorier ou l'administrateur utilise les boutons
 * « WhatsApp » de l'application, qui ouvrent la conversation avec un message prérempli.
 *
 * Un membre peut refuser les emails de rappel dans son profil ; les autres messages (validation, décision sur un prêt...)
 * lui parviennent toujours.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repo;
    private final MembreRepository membreRepo;
    private final EmailService emailService;

    // ------------------------------------------------------------------
    // Envoi
    // ------------------------------------------------------------------

    public Notification informer(Long destinataireId, NotifType type, String sujet, String message,
                                 TopicType topic, Long topicId, boolean parEmail) {
        return informer(destinataireId, type, sujet, message, topic, topicId, parEmail, null);
    }

    /**
     * @param cle clé facultative qui évite d'envoyer deux fois le même message (ex. « J-3 », « COTIS-2026-11 »)
     * @return la notification créée, ou null si ce message avait déjà été envoyé
     */
    public Notification informer(Long destinataireId, NotifType type, String sujet, String message,
                                 TopicType topic, Long topicId, boolean parEmail, String cle) {
        if (destinataireId == null) return null;
        if (cle != null && repo.existsByDestinataireIdAndTopicTypeAndTopicIdAndSousType(destinataireId, topic, topicId, cle)) {
            return null;
        }
        Notification n = new Notification();
        n.setDestinataireId(destinataireId);
        n.setType(type);
        n.setCanal(parEmail ? Canal.EMAIL : Canal.PUSH);
        n.setSujet(sujet);
        n.setMessageRendu(message);
        n.setEtat(NotifEtat.ENVOYE);
        n.setTopicType(topic == null ? TopicType.AUTRE : topic);
        n.setTopicId(topicId);
        n.setSousType(cle);
        n.setDateEnvoi(LocalDateTime.now());
        Notification saved = repo.save(n);

        if (parEmail) {
            try {
                membreRepo.findById(destinataireId).ifPresent(m -> envoyerEmail(m, type, sujet, message, n.getTopicType()));
            } catch (Exception e) {
                log.warn("Email non envoyé à {} : {}", destinataireId, e.getMessage());
            }
        }
        return saved;
    }

    private void envoyerEmail(Membre m, NotifType type, String sujet, String message, TopicType topic) {
        if (!emailService.estActif()) return;
        if (type == NotifType.RAPPEL && Boolean.FALSE.equals(m.getNotificationsEmail())) return; // refus des rappels
        emailService.envoyerAsync(m.getId(), m.getEmail(), sujet, sujet, message, type.name() + "_" + topic.name());
    }

    /** « Prénom Nom » d'un membre (pour les messages). */
    public String nomDe(Long membreId) {
        if (membreId == null) return "un membre";
        return membreRepo.findById(membreId)
                .map(m -> ((m.getFirstName() == null ? "" : m.getFirstName()) + " " + (m.getLastName() == null ? "" : m.getLastName())).trim())
                .filter(s -> !s.isBlank()).orElse("un membre");
    }

    /** Un message qui ne peut pas partir ne doit jamais faire échouer l'action de l'utilisateur. */
    public void sansRisque(Runnable envoi) {
        try {
            envoi.run();
        } catch (Exception e) {
            log.warn("Notification non envoyée : {}", e.getMessage());
        }
    }

    /** Informe tous les membres actifs ayant l'un de ces rôles (ex. le président pour une confirmation). */
    public int informerRoles(Collection<RoleMembre> roles, NotifType type, String sujet, String message,
                             TopicType topic, Long topicId, boolean parEmail) {
        int n = 0;
        for (Membre m : membreRepo.findByEtatCompte(EtatCompte.ACTIF)) {
            if (roles.contains(m.getRole())) {
                if (informer(m.getId(), type, sujet, message, topic, topicId, parEmail) != null) n++;
            }
        }
        return n;
    }

    /** Compatibilité : l'ancien canal EMAIL = notification + email ; tout autre canal = notification seule. */
    public Notification envoyer(NotifType type, Long destinataireId, Canal canal, String sujet, String message,
                                TopicType topicType, Long topicId) {
        return informer(destinataireId, type, sujet, message, topicType, topicId, canal == Canal.EMAIL);
    }

    // ------------------------------------------------------------------
    // Consultation (la cloche)
    // ------------------------------------------------------------------

    public Page<Notification> listByDest(Long destinataireId, int page, int size) {
        return repo.findByDestinataireIdOrderByDateEnvoiDesc(destinataireId, PageRequest.of(page, size));
    }

    public long countNonLues(Long destinataireId) {
        return repo.countByDestinataireIdAndEtat(destinataireId, NotifEtat.ENVOYE);
    }

    @Transactional
    public void marquerCommeLue(Long id) {
        repo.markAsRead(id, NotifEtat.LU);
    }

    @Transactional
    public int marquerToutesLues(Long destinataireId) {
        return repo.markAllAsRead(destinataireId, NotifEtat.LU, NotifEtat.ENVOYE);
    }
}
