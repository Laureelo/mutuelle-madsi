package com.madsi.backend.manifestations.dto;

import com.madsi.backend.common.Enums;
import jakarta.validation.constraints.*;

public record TypeActiviteIn(
        @NotBlank String libelle,
        @NotNull Enums.TypeActiviteCat type,
        @Size(max=200) String sousType,
        @PositiveOrZero Integer montantAlloue,
        @Size(max=200) String lieu
) {}