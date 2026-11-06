package com.madsi.backend.settings.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;


@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class SettingsDTO {

    private Organisation organisation;
    private Finance finance;
    private Notifications notifications;
    private Exports exports;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Organisation {
        private String nom;
        private String emailContact;
        private String phoneContact;
        private String adresse;
        private String logoUrl;
        private String devise; // ex FCFA
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Finance {
        private Integer montantCotisation;          // cotisation mensuelle (règlement intérieur, art. 10 : 1 000 FCFA)
        private Integer montantAdhesion;            // droit d'adhésion (règlement intérieur, art. 9 : 2 000 FCFA)
        private Integer seuilConfirmationDepense;   // au-delà, une dépense ou un prêt doit être confirmé par le président (admin)
        private Integer plafondEncoursPrets;        // un membre ne peut pas dépasser ce total de prêts non remboursés
        private Boolean exigerCotisationsAJour;     // exiger d'être à jour des cotisations pour un prêt ou une prestation
        private Integer penaliteRetard;             // % ou montant (selon ton choix)
        private String debutExercice;               // YYYY-MM-DD
        private String prefixRecu;                  // ex: MADSI-
        private Boolean motifAnnulationObligatoire; // force un motif quand on annule
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Notifications {
        private Boolean canalEmailEnabled;            // interrupteur général des emails (la messagerie se configure dans backend/.env)
        private Boolean rappelsCotisationsEnabled;    // rappel mensuel aux membres en retard de cotisation
        private Boolean rappelsEcheancesEnabled;      // rappels avant et après chaque échéance de remboursement
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Exports {
        private String footer;     // ex: "MADSI — Généré le {{date}}"
    }
}