package com.madsi.backend.adhesions.dto;

import com.madsi.backend.adhesions.PaiementAdhesion;
import com.madsi.backend.common.Enums;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PaiementAdhesionDTO(
        Long id,
        Long membreId,
        BigDecimal montant,
        Enums.ModePaiement modePaiement,
        OffsetDateTime datePaiement,
        String reference,
        String photoPreuve,
        PaiementAdhesion.StatutPaiementAdhesion statut,
        Long enregistreParTresorier,
        OffsetDateTime dateEnregistrement,
        Long valideParAdmin,
        OffsetDateTime dateValidationAdmin,
        String remarques,
        Long operationId
) {
    public static PaiementAdhesionDTO fromEntity(PaiementAdhesion entity) {
        return new PaiementAdhesionDTO(
                entity.getId(),
                entity.getMembreId(),
                entity.getMontant(),
                entity.getModePaiement(),
                entity.getDatePaiement(),
                entity.getReference(),
                entity.getPhotoPreuve(),
                entity.getStatut(),
                entity.getEnregistreParTresorier(),
                entity.getDateEnregistrement(),
                entity.getValideParAdmin(),
                entity.getDateValidationAdmin(),
                entity.getRemarques(),
                entity.getOperationId()
        );
    }
}
