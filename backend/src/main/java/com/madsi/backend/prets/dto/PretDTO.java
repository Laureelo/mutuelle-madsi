package com.madsi.backend.prets.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PretDTO(
        Long id,
        Long membreId,
        String membreNom,       // Nom de famille
        String membrePrenom,    // Prénom
        BigDecimal montant,     // montantAccorde
        Integer duree,          // nombre d'échéances
        String periodeUnite,    // JOUR, SEMAINE, MOIS
        LocalDate dateDemande,
        LocalDate dateValidation,
        LocalDate dateDecaissement,
        BigDecimal montantRembourse,
        BigDecimal montantRestant,  // montant - montantRembourse
        String statut,          // DEMANDE, APPROUVE, REFUSE, EN_COURS, CLOTURE
        String motif,           // Motif de la demande de prêt (facultatif)
        String motifRejet,      // Motif de rejet si statut = REFUSE
        @JsonIgnore String photoPreuve,     // Base64 ou URL de la preuve de paiement
        Boolean confirmationRequise,        // montant au-dessus du seuil et pas encore confirmé par le président (admin)
        Boolean confirme,                   // confirmé par le président (admin)
        Integer moisImpayesMembre           // mois de cotisation impayés du demandeur (information pour la décision, null si sans objet)
) {
    /** Indique qu'une preuve de paiement est jointe (l'image se charge à la demande : GET /api/preuves/...). */
    @JsonProperty("aPreuve")
    public boolean aPreuve() {
        return photoPreuve != null && !photoPreuve.isBlank();
    }
}
















