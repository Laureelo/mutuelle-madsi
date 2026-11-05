package com.madsi.backend.prets;

import com.madsi.backend.common.Enums.EchStatut;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(
        name = "echeances",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_echeance_pret_numero", columnNames = {"pret_id","numero"})
        },
        indexes = {
                @Index(name = "idx_echeance_pret", columnList = "pret_id"),
                @Index(name = "idx_echeance_date", columnList = "date_echeance")
        }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Echeance {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="pret_id", nullable=false)
    private Long pretId;

    @Column(nullable=false)
    private Integer numero; // 1..duree

    @Column(name="date_echeance", nullable=false)
    private LocalDate dateEcheance;

    @Column(name="montant_du", nullable=false, precision=12, scale=2)
    private BigDecimal montantDu;

    @Enumerated(EnumType.STRING)
    @Column(nullable=false)
    @Builder.Default
    private EchStatut statut = EchStatut.EN_ATTENTE; // "à payer"
}