// src/main/java/com/madsi/backend/operations/dto/OperationDTO.java
package com.madsi.backend.operations.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import com.madsi.backend.common.Enums.*;
import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.Enums.OpStatut;
import com.madsi.backend.common.Enums.SensOp;
import com.madsi.backend.common.Enums.TypeOperation;

public record OperationDTO(
        Long id,
        OffsetDateTime dateOp,      // ⚠ front attend "dateOp"
        BigDecimal montant,
        SensOp sens,
        TypeOperation typeOp,       // ⚠ front affiche "typeOp"
        ModePaiement modePaiement,
        String reference,
        OpStatut statut,
        Long membreId,
        String objetType,
        Long objetId,
        Long recuId,                // dernier reçu lié (peut être null)
        String membreNom,           // Nom du membre (peut être null)
        String membrePrenom,        // Prénom du membre (peut être null)
        @JsonIgnore String photoPreuve          // Preuve de paiement (Base64 ou URL)
) {
    /** Indique qu'une preuve de paiement est jointe (l'image se charge à la demande : GET /api/preuves/...). */
    @JsonProperty("aPreuve")
    public boolean aPreuve() {
        return photoPreuve != null && !photoPreuve.isBlank();
    }
}