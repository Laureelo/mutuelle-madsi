package com.madsi.backend.prets;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import com.madsi.backend.common.Enums.PeriodeUnite;
import com.madsi.backend.common.Enums.PretStatut;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "prets")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Pret {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "membre_id", nullable = false)
    private Long membreId;

    @Column(name = "montant_accorde", nullable = false, precision = 12, scale = 2)
    private BigDecimal montantAccorde;

    /** Nombre d'échéances */
    @Column(name = "duree_mois", nullable = false)
    private Integer dureeMois;

    /** Unité de la période (JOUR, SEMAINE, MOIS) - par défaut MOIS pour rétrocompatibilité */
    @Enumerated(EnumType.STRING)
    @Column(name = "periode_unite")
    @Builder.Default
    private PeriodeUnite periodeUnite = PeriodeUnite.MOIS;

    @Column(name = "date_demande", nullable = false)
    @Builder.Default
    private LocalDate dateDemande = LocalDate.now();

    @Column(name = "date_validation")
    private LocalDate dateValidation;

    @Column(name = "date_decaissement")
    private LocalDate dateDecaissement;

    /** Somme cumulée remboursée (mise à jour à chaque remboursement) */
    @Column(name = "montant_rembourse", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal montantRembourse = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PretStatut statut = PretStatut.DEMANDE;

    /** Président (administrateur) qui a confirmé le prêt, obligatoire au-delà du seuil de confirmation. */
    @Column(name = "confirme_par")
    private Long confirmePar;

    @Column(name = "date_confirmation")
    private java.time.LocalDate dateConfirmation;

    /** Motif de la demande de prêt (facultatif) */
    @Column(name = "motif", columnDefinition = "TEXT")
    private String motif;

    /** Motif de rejet si statut = REFUSE */
    @Column(name = "motif_rejet", columnDefinition = "TEXT")
    private String motifRejet;

    /** Preuve de paiement (Base64 ou URL) */
    @Column(name = "photo_preuve", columnDefinition = "TEXT")
    @JsonIgnore // la preuve (image) n'est jamais envoyée dans les listes : voir GET /api/preuves/...
    private String photoPreuve;

    /** Indique qu'une preuve de paiement est jointe (l'image se charge à la demande). */
    @JsonProperty("aPreuve")
    public boolean isAPreuve() {
        return photoPreuve != null && !photoPreuve.isBlank();
    }
}