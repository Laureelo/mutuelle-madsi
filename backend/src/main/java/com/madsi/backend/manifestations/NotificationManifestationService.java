package com.madsi.backend.manifestations;

import com.madsi.backend.common.Enums.NotifType;
import com.madsi.backend.common.Enums.TopicType;
import com.madsi.backend.notifications.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

/** Messages liés aux manifestations (validation, rejet, annonce à tous les membres, annulation). */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationManifestationService {

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final NotificationService notif;

    /** Le déclarant apprend que sa demande est validée. */
    public void sendValidation(Long destinataireId, Manifestation m) {
        notif.informer(destinataireId, NotifType.INFO, "Manifestation validée : " + m.getLibelle(),
                "Votre manifestation « " + m.getLibelle() + " » du " + jour(m) + lieu(m) + " a été validée.",
                TopicType.MANIFESTATION, m.getId(), true);
    }

    /** Le déclarant apprend que sa demande est rejetée, avec le motif. */
    public void sendRejet(Long destinataireId, Manifestation m, String motif) {
        notif.informer(destinataireId, NotifType.ALERTE, "Manifestation non retenue : " + m.getLibelle(),
                "Votre manifestation « " + m.getLibelle() + " » n'a pas été retenue.\n\nMotif : " + motif,
                TopicType.MANIFESTATION, m.getId(), true);
    }

    /** Annonce à un membre : manifestation validée (sousType VALIDATION) ou annulée (ANNULATION). */
    public void sendNotificationGenerale(Long destinataireId, Manifestation m, String sousType) {
        boolean annulee = "ANNULATION".equals(sousType);
        String sujet = (annulee ? "Manifestation annulée : " : "Nouvelle manifestation : ") + m.getLibelle();
        String texte = annulee
                ? "La manifestation « " + m.getLibelle() + " » prévue le " + jour(m) + lieu(m) + " est annulée."
                : "La manifestation « " + m.getLibelle() + " » aura lieu le " + jour(m) + lieu(m) + ".";
        notif.informer(destinataireId, annulee ? NotifType.ALERTE : NotifType.INFO, sujet, texte,
                TopicType.MANIFESTATION, m.getId(), true, "MANIF-" + sousType);
    }

    private static String jour(Manifestation m) {
        return m.getDate() == null ? "(date à préciser)" : m.getDate().format(JOUR);
    }

    private static String lieu(Manifestation m) {
        return (m.getLieu() == null || m.getLieu().isBlank()) ? "" : " à " + m.getLieu();
    }
}
