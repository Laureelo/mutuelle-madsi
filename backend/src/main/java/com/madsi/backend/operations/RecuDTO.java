package com.madsi.backend.operations;

import com.madsi.backend.common.Enums;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Reçu tel qu'il est renvoyé par l'API (sans lien vers l'entité Operation, qui n'est chargée qu'à la demande). */
public record RecuDTO(
        Long id,
        String numero,
        OffsetDateTime dateRecu,
        BigDecimal montant,
        Enums.ObjetRecu objet,
        Enums.ModePaiement modePaiement,
        String reference,
        String fichierPdfUrl,
        Long operationId
) {
    public static RecuDTO from(Recu r) {
        return new RecuDTO(
                r.getId(), r.getNumero(), r.getDateRecu(), r.getMontant(), r.getObjet(),
                r.getModePaiement(), r.getReference(), r.getFichierPdfUrl(),
                r.getOperation() != null ? r.getOperation().getId() : null);
    }
}
