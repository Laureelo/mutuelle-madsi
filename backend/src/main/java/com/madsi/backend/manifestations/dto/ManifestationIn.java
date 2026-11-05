// src/main/java/com/madsi/backend/manifestations/dto/ManifestationIn.java
package com.madsi.backend.manifestations.dto;

import com.madsi.backend.common.Enums;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record ManifestationIn(
        @NotNull Long membreId,
        @NotNull Long typeActiviteId,
        @NotBlank @Size(max=200) String libelle,
        @NotNull LocalDate date,
        @Size(max=200) String lieu,
        @Size(max=2000) String description,
        Enums.ManifStatut statut // optionnel côté client; défaut mis en service si null
) {}