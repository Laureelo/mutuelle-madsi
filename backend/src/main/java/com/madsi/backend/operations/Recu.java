package com.madsi.backend.operations;

import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.Enums.ObjetRecu;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity @Table(name="recus")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Recu {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = true, unique = true)
    private String numero;

    @Column(name="date_recu", nullable=false)
    private OffsetDateTime dateRecu = OffsetDateTime.now();

    @Column(nullable=false, precision=12, scale=2)
    private BigDecimal montant;

    @Enumerated(EnumType.STRING) @Column(nullable=false)
    private ObjetRecu objet;

    @Enumerated(EnumType.STRING)
    @Column(name="mode_paiement")
    private ModePaiement modePaiement;

    private String reference;

    @Column(name="fichier_pdf_url")
    private String fichierPdfUrl; // on branchera plus tard le vrai PDF

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="operation_id", nullable=false)
    private Operation operation;
}
