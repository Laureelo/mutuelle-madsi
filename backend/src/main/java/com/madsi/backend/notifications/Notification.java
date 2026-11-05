package com.madsi.backend.notifications;

import com.madsi.backend.common.Enums.*;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "notifications",
        indexes = {
                @Index(name="idx_notif_dest_date", columnList="destinataire_id,date_envoi"),
                @Index(name="idx_notif_etat", columnList="etat"),
                @Index(name="idx_notif_topic", columnList="topic_type,topic_id"),
                @Index(name="idx_notif_template", columnList="template_id")
        }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "destinataire_id", nullable = false)
    private Long destinataireId;

    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private NotifType type;            // RAPPEL / ALERTE / INFO

    @Column(name = "sous_type")
    private String sousType;           // ex: DECES, MARIAGE (optionnel)

    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Canal canal;               // PUSH / EMAIL / WHATSAPP

    @Column private String sujet;

    @Column(name = "message_rendu", columnDefinition = "text")
    private String messageRendu;

    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private NotifEtat etat;            // ENVOYE / ECHEC / LU

    @Column(name = "date_envoi", nullable = false)
    private LocalDateTime dateEnvoi;

    @PrePersist
    void prePersist() {
        if (dateEnvoi == null) dateEnvoi = LocalDateTime.now();
        if (etat == null) etat = NotifEtat.ENVOYE;
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "topic_type", nullable = false)
    private TopicType topicType;       // COTISATION / PRET / ECHEANCE / MANIFESTATION / AUTRE

    @Column(name = "topic_id")
    private Long topicId;

    @Column(name = "template_id")
    private Long templateId;
}