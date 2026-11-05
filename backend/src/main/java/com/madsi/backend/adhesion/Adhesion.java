package com.madsi.backend.adhesion;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import com.madsi.backend.common.Enums;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entité représentant le paiement d'adhésion de 2000 FCFA
 * pour passer du statut VISITEUR à MEMBRE_ACTIF
 */
@Entity
@Table(name = "adhesions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Adhesion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * ID du membre qui effectue le paiement d'adhésion
     */
    @Column(nullable = false)
    private Long membreId;

    /**
     * Montant de l'adhésion (normalement 2000 FCFA)
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal montant;

    /**
     * Date de déclaration du paiement par le membre
     */
    @Column(nullable = false)
    private OffsetDateTime datePaiement;

    /**
     * Mode de paiement utilisé
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Enums.ModePaiement modePaiement;

    /**
     * Référence de la transaction (numéro de transaction Mobile Money, etc.)
     */
    @Column(length = 100)
    private String reference;

    /**
     * Photo/Capture d'écran de preuve de paiement (encodée en Base64)
     */
    @Column(columnDefinition = "TEXT")
    @JsonIgnore // la preuve (image) n'est jamais envoyée dans les listes : voir GET /api/preuves/...
    private String photoPreuve;

    /** Indique qu'une preuve de paiement est jointe (l'image se charge à la demande). */
    @JsonProperty("aPreuve")
    public boolean isAPreuve() {
        return photoPreuve != null && !photoPreuve.isBlank();
    }

    /**
     * Statut du paiement : EN_ATTENTE, VALIDE, REJETE
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutAdhesion statut;

    /**
     * ID du trésorier qui a validé ou rejeté le paiement
     */
    private Long valideParTresorerie;

    /**
     * Date de validation/rejet par le trésorier
     */
    private OffsetDateTime dateValidation;

    /**
     * Remarque du membre lors de la déclaration
     */
    @Column(columnDefinition = "TEXT")
    private String remarque;

    /**
     * Motif de rejet si statut = REJETE
     */
    @Column(columnDefinition = "TEXT")
    private String motifRejet;

    /**
     * ID de l'opération comptable associée (si validée)
     */
    private Long operationId;

    /**
     * Date de création de l'enregistrement
     */
    @Column(nullable = false, updatable = false)
    private OffsetDateTime dateCreation;

    @PrePersist
    protected void onCreate() {
        if (dateCreation == null) {
            dateCreation = OffsetDateTime.now();
        }
        if (statut == null) {
            statut = StatutAdhesion.EN_ATTENTE;
        }
    }

    public enum StatutAdhesion {
        EN_ATTENTE,  // Déclaré par le membre, en attente de validation
        VALIDE,      // Validé par le trésorier
        REJETE       // Rejeté par le trésorier
    }
}
