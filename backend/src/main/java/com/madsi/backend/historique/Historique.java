// src/main/java/com/madsi/backend/historique/Historique.java
package com.madsi.backend.historique;

import com.madsi.backend.common.Enums.HistoType;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name="historiques", indexes = {
        @Index(name="idx_hist_membre", columnList="membre_id"),
        @Index(name="idx_hist_date", columnList="date_evt"),
        @Index(name="idx_hist_type", columnList="type")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Historique {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="membre_id")
    private Long membreId;          // acteur ou personne concernée

    private String action;          // ex: "Création cotisation", "Validation compte"
    @Column(length = 2000)
    private String details;         // ex: "id=12, montant=5000"

    @Enumerated(EnumType.STRING)
    @Column(name="type", length = 30, nullable = false)
    private HistoType type;         // PARAMETRE | ADHESION | FINANCE | SYSTEME ...

    private String objetType;       // ex: "cotisation", "pret", "manifestation"
    private Long objetId;           // id de l’objet

    @Column(name="date_evt", nullable = false)
    private OffsetDateTime dateEvt = OffsetDateTime.now();
}
