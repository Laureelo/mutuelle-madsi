package com.madsi.backend.mail;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Journal des emails envoyés (ou en échec) : permet à l'administrateur de savoir ce qui est réellement parti. */
@Entity
@Table(name = "email_log", indexes = @Index(name = "idx_email_log_date", columnList = "date_envoi"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmailLog {

    public static final String ENVOYE = "ENVOYE";
    public static final String ECHEC = "ECHEC";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "destinataire_id")
    private Long destinataireId;

    @Column(nullable = false, length = 255)
    private String adresse;

    @Column(length = 255)
    private String sujet;

    /** Nature du message (ex. COTISATION_VALIDEE, MOT_DE_PASSE, ANNONCE). */
    @Column(length = 40)
    private String type;

    @Column(nullable = false, length = 10)
    private String statut;

    @Column(length = 500)
    private String erreur;

    @Column(name = "date_envoi", nullable = false)
    private LocalDateTime dateEnvoi;
}
