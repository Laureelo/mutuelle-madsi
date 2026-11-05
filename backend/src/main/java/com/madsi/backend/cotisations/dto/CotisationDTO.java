package com.madsi.backend.cotisations.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;


import java.math.BigDecimal;
import java.time.LocalDate;

public record CotisationDTO(
        Long id,
        Long membreId,
        String membreNom,       // "Prénom NOM"
        String membreEmail,
        String periode,         // AAAA-MM
        BigDecimal montant,
        LocalDate datePaiement,
        String statut,          // PAYE | PARTIEL | EN_RETARD
        String modePaiement,    // ESPECES | MOBILE_MONEY
        String reference,
        Long operationId,
        String numeroRecu,      // ex: RC-2025-10-0123 (si tu le stockes sur 'recus')
        @JsonIgnore String photoPreuve      // Base64 ou URL de la preuve de paiement
) {
    /** Indique qu'une preuve de paiement est jointe (l'image se charge à la demande : GET /api/preuves/...). */
    @JsonProperty("aPreuve")
    public boolean aPreuve() {
        return photoPreuve != null && !photoPreuve.isBlank();
    }
}
