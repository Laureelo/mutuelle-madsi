// src/main/java/com/madsi/backend/rapports/RapportExport.java
package com.madsi.backend.rapports;


import com.madsi.backend.common.Enums;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity @Table(name="rapports_exports", indexes = {
        @Index(name="idx_rapports_type", columnList="type"),
        @Index(name="idx_rapports_date", columnList="genere_le")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RapportExport {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING) @Column(nullable=false)
    private Enums.RapportType type;

    @Column(nullable=false) private String periode;     // ex: "2025-01..2025-12"
    @Column(nullable=false) private String format;      // PDF | CSV | XLSX
    @Column(nullable=false) private String fichierPath; // chemin disque
    @Column(nullable=false) private String fichierUrl;  // ex: /api/rapports/exports/{id}/file

    @Column(name="genere_le", nullable=false)
    private OffsetDateTime genereLe;

    @Column(name="total_global")
    private java.math.BigDecimal totalGlobal;           // total utile (financier)

    @Lob @Column(name="params_json")
    private String paramsJson;                          // params fournis

    @Lob @Column(name="meta_json")
    private String metaJson;                            // petits indicateurs (entrées/sorties, etc.)

    @Column
    private Long generatedBy;

    @Column(columnDefinition = "TEXT")
    private String contenu;

    @Column
    private String fichierExcelUrl;
}
