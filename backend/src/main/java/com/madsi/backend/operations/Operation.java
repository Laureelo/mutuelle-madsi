package com.madsi.backend.operations;


import com.madsi.backend.common.Enums.*;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name="operations",
        indexes = {
                @Index(name="idx_op_date", columnList="date_op"),
                @Index(name="idx_op_type", columnList="type_op"),
                @Index(name="idx_op_membre", columnList="membre_id"),
                @Index(name="idx_op_obj", columnList="objet_type, objet_id"),
                @Index(name="idx_op_statut", columnList="statut")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Operation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // horodatage exact (OFFSET pour timezone)
    @Column(name="date_op", nullable=false)
    private OffsetDateTime dateOp = OffsetDateTime.now();

    // montant positif (pour SORTIE c'est le sens qui indique la sortie)
    @Column(nullable=false, precision=12, scale=2)
    private BigDecimal montant;

    // ENTREE | SORTIE
    @Enumerated(EnumType.STRING) @Column(nullable=false)
    private SensOp sens;

    // COTISATION | APPORT | RECETTE | DEPENSE | REMBOURSEMENT_PRET ...
    @Enumerated(EnumType.STRING) @Column(name="type_op", nullable=false)
    private TypeOperation typeOp;

    // ESPECES | MOBILE_MONEY
    @Enumerated(EnumType.STRING) @Column(name="mode_paiement")
    private ModePaiement modePaiement;

    // référence transaction (mobile money / bordereau)
    private String reference;

    // ENREGISTREE | ANNULEE
    @Enumerated(EnumType.STRING) @Column(nullable=false)
    private OpStatut statut = OpStatut.ENREGISTREE;

    // membre concerné si applicable (cotisation, remboursement, prêt…)
    @Column(name="membre_id")
    private Long membreId;

    // rattachement à l'objet source pour retrouver l'historique
    @Column(name="objet_type") private String objetType; // "cotisation", "pret", "manifestation", etc.
    @Column(name="objet_id")   private Long objetId;

    // Preuve de paiement (Base64 ou URL)
    @Column(name = "photo_preuve", columnDefinition = "TEXT")
    private String photoPreuve;
}
