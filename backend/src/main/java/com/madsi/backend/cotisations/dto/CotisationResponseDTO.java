package com.madsi.backend.cotisations.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO pour les réponses de cotisations avec informations du membre
 */
public record CotisationResponseDTO(
        Long id,
        Long membreId,
        String membreNom,       // "Prénom NOM"
        String membreEmail,
        String periodes,        // CSV: "2026-01,2026-02,2026-03"
        Integer nombreMois,
        BigDecimal montant,
        LocalDate datePaiement,
        String statut,          // EN_ATTENTE | PAYE | PARTIEL | EN_RETARD | REJETE
        String modePaiement,    // ESPECES | MOBILE_MONEY
        String reference,
        String remarque,
        Long operationId,
        Long valideParTresorier,
        LocalDate dateValidation,
        @JsonIgnore String photoPreuve      // Preuve de paiement (Base64 ou URL)
) {
    /** Indique qu'une preuve de paiement est jointe (l'image se charge à la demande : GET /api/preuves/...). */
    @JsonProperty("aPreuve")
    public boolean aPreuve() {
        return photoPreuve != null && !photoPreuve.isBlank();
    }
}
