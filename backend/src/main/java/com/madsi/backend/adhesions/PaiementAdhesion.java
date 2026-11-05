package com.madsi.backend.adhesions;

import com.madsi.backend.common.Enums;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entité pour gérer les paiements d'adhésion des futurs membres.
 * Montant fixe : 2000 F CFA
 */
@Entity
@Table(name = "paiements_adhesion", indexes = {
    @Index(name = "idx_paiement_adhesion_membre", columnList = "membre_id"),
    @Index(name = "idx_paiement_adhesion_statut", columnList = "statut"),
    @Index(name = "idx_paiement_adhesion_date", columnList = "date_paiement")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaiementAdhesion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Référence au membre qui paie son adhésion
     */
    @Column(name = "membre_id", nullable = false)
    private Long membreId;

    /**
     * Montant du paiement d'adhésion (normalement 2000 F CFA)
     */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal montant;

    /**
     * Mode de paiement : ESPECES ou MOBILE_MONEY
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "mode_paiement", nullable = false)
    private Enums.ModePaiement modePaiement;

    /**
     * Date du paiement effectif
     */
    @Column(name = "date_paiement", nullable = false)
    private OffsetDateTime datePaiement;

    /**
     * Référence du paiement (numéro de transaction mobile money ou numéro de reçu papier)
     */
    @Column(length = 255)
    private String reference;

    /**
     * URL de la photo de la preuve de paiement (reçu mobile money, photo du reçu papier)
     */
    @Column(name = "photo_preuve", length = 500)
    private String photoPreuve;

    /**
     * Statut du paiement : EN_ATTENTE, VALIDE, REJETE
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutPaiementAdhesion statut = StatutPaiementAdhesion.EN_ATTENTE;

    /**
     * ID du trésorier qui a enregistré le paiement
     */
    @Column(name = "enregistre_par_tresorier")
    private Long enregistreParTresorier;

    /**
     * Date d'enregistrement du paiement par le trésorier
     */
    @Column(name = "date_enregistrement")
    private OffsetDateTime dateEnregistrement = OffsetDateTime.now();

    /**
     * ID de l'admin métier qui a validé l'adhésion finale
     */
    @Column(name = "valide_par_admin")
    private Long valideParAdmin;

    /**
     * Date de validation finale par l'admin métier
     */
    @Column(name = "date_validation_admin")
    private OffsetDateTime dateValidationAdmin;

    /**
     * Remarques ou notes sur le paiement
     */
    @Column(columnDefinition = "TEXT")
    private String remarques;

    /**
     * ID de l'opération financière associée (si créée)
     */
    @Column(name = "operation_id")
    private Long operationId;

    /**
     * Enum pour le statut du paiement d'adhésion
     */
    public enum StatutPaiementAdhesion {
        EN_ATTENTE,          // Enregistré par le trésorier, en attente de validation admin
        VALIDE,              // Validé par l'admin métier, membre activé
        REJETE               // Rejeté par l'admin métier
    }
}
