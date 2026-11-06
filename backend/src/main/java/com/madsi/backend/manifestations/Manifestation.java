package com.madsi.backend.manifestations;

import com.madsi.backend.common.Enums;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "manifestations") // nom de table fixe
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Manifestation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long membreId;
    private Long typeActiviteId;

    @Column(nullable = false, length = 200)
    private String libelle;

    @Column(nullable = false)
    private LocalDate date;

    private String lieu;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Enums.ManifStatut statut;

    // Champs pour le formulaire de clôture (remplis par le trésorier)
    @Column(name = "montant_prevu", precision = 12, scale = 2)
    private java.math.BigDecimal montantPrevu;

    @Column(name = "montant_reel", precision = 12, scale = 2)
    private java.math.BigDecimal montantReel;

    @Column(name = "materiaux", length = 2000)
    private String materiaux; // matériaux/ressources utilisés

    @Column(name = "remarques", length = 2000)
    private String remarques;

    @Column(name = "date_cloture")
    private LocalDate dateCloture;

    @Column(name = "cloture_par")
    private Long cloturePar; // id du trésorier qui a clôturé

    // Champs de validation
    @Column(name = "est_validee")
    @Builder.Default
    private Boolean estValidee = false;

    @Column(name = "date_validation")
    private LocalDate dateValidation;

    @Column(name = "valide_par")
    private Long validePar; // id du trésorier/admin qui a validé
}