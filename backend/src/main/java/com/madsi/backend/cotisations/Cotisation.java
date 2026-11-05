package com.madsi.backend.cotisations;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.Enums.CotiStatut;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Table(name="cotisations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Cotisation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="membre_id", nullable=false)
    private Long membreId;

    /**
     * Liste des périodes payées (format: 2026-01,2026-02,2026-03)
     * Pour un paiement multi-mois
     */
    @Column(nullable=false, length=255, name="periodes")
    private String periodes;

    /**
     * Nombre de mois payés
     */
    @Column(nullable=false, name="nombre_mois")
    @Builder.Default
    private Integer nombreMois = 1;

    @Column(nullable=false, precision=12, scale=2)
    private BigDecimal montant;

    @Column(name="date_paiement")
    private LocalDate datePaiement;

    @Column(name = "mode_paiement", length = 30)
    @Enumerated(EnumType.STRING)
    private Enums.ModePaiement modePaiement;

    @Column(length = 100)
    private String reference; // Référence transaction bancaire ou code interne

    @Column(columnDefinition = "TEXT")
    private String remarque; // Remarque du membre lors de la déclaration

    /**
     * Motif de rejet si statut = REJETE
     */
    @Column(columnDefinition = "TEXT", name="motif_rejet")
    private String motifRejet;

    /**
     * Photo/capture de preuve de paiement encodée en Base64
     * (peut être très longue pour les images)
     */
    @Column(columnDefinition = "TEXT", name="photo_preuve")
    @JsonIgnore // la preuve (image) n'est jamais envoyée dans les listes : voir GET /api/preuves/...
    private String photoPreuve;

    /** Indique qu'une preuve de paiement est jointe (l'image se charge à la demande). */
    @JsonProperty("aPreuve")
    public boolean isAPreuve() {
        return photoPreuve != null && !photoPreuve.isBlank();
    }

    /**
     * Statut: EN_ATTENTE (déclaré), PAYE (validé), PARTIEL (partiel), EN_RETARD
     */
    @Enumerated(EnumType.STRING) @Column(nullable=false)
    @Builder.Default
    private CotiStatut statut = CotiStatut.EN_ATTENTE;

    /**
     * ID du trésorier qui a validé
     */
    @Column(name="valide_par_tresorier")
    private Long valideParTresorier;

    /**
     * Date de validation par le trésorier
     */
    @Column(name="date_validation")
    private LocalDate dateValidation;

    @Column(name="operation_id")
    private Long operationId;

    // Constante : montant mensuel de cotisation
    public static final BigDecimal MONTANT_MENSUEL = new BigDecimal("1000.00");
}
