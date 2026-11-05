// src/main/java/com/madsi/backend/rapports/dto/RapportExportDTO.java
package com.madsi.backend.rapports.dto;


import com.madsi.backend.common.Enums;

import java.time.OffsetDateTime;
import java.math.BigDecimal;

public record RapportExportDTO(
        Long id,
        Enums.RapportType type,
        String periode,
        String format,
        String fichierUrl,
        OffsetDateTime genereLe,
        BigDecimal totalGlobal
) {}
