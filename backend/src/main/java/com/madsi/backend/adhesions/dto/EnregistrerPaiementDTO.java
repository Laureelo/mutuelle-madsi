package com.madsi.backend.adhesions.dto;

import com.madsi.backend.common.Enums;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

/**
 * DTO pour l'enregistrement d'un paiement d'adhésion par le trésorier
 */
public record EnregistrerPaiementDTO(
        @NotNull(message = "L'ID du membre est requis")
        Long membreId,

        @NotNull(message = "Le mode de paiement est requis")
        Enums.ModePaiement modePaiement,

        @NotNull(message = "La date de paiement est requise")
        OffsetDateTime datePaiement,

        String reference,
        String photoPreuve,
        String remarques
) {
}
