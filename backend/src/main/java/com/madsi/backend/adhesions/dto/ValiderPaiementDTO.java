package com.madsi.backend.adhesions.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO pour la validation ou le rejet d'un paiement d'adhésion par l'admin métier
 */
public record ValiderPaiementDTO(
        @NotBlank(message = "Le motif de rejet est requis")
        String motif
) {
}
