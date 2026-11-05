package com.madsi.backend.prets;

import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.Enums.RemStatut;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(
        name="remboursements",
        indexes = {
                @Index(name="idx_remb_echeance", columnList="echeance_id"),
                @Index(name="idx_remb_date", columnList="date_paiement")
        }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RemboursementPret {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="echeance_id", nullable=false)
    private Long echeanceId;

    @Column(name="date_paiement", nullable=false)
    private LocalDate datePaiement = LocalDate.now();

    @Enumerated(EnumType.STRING)
    @Column(name="mode_paiement", nullable=false)
    private ModePaiement modePaiement;

    @Enumerated(EnumType.STRING)
    @Column(nullable=false)
    private RemStatut statut; // EN_ATTENTE / ENREGISTRE / REJETE / ANNULE

    @Column(name="operation_id")
    private Long operationId;

    @Column(name="montant", nullable=false, precision=12, scale=2)
    private BigDecimal montant;

    // ✅ pour le flux mobile
    @Column(length = 120)
    private String reference;   // TxnID mobile money, etc.

    @Column(name="preuve_url", length = 500)
    private String preuveUrl;   // lien capture/fichier (si upload géré côté infra)
}