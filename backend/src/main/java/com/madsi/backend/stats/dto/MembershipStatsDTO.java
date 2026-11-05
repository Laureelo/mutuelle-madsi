package com.madsi.backend.stats.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

/** Statistiques des membres, des cotisations et des activités (manifestations) d'un exercice. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MembershipStatsDTO {
    private int year;

    // --- Membres (situation d'aujourd'hui) ---
    private long totalMembres;
    private long membresActifs;
    private long membresEnAttente;     // inscrits qui attendent la validation (secrétariat / trésorerie)
    private long membresInactifs;
    private long visiteurs;

    // --- Cotisations (membres actifs) ---
    private long membresAJour;
    private long membresEnRetard;
    private Double tauxAJour;          // pourcentage 0..100 (null si aucun membre actif)
    private BigDecimal montantImpaye;  // total des cotisations dues et non réglées
    private long avertissementsPossibles; // membres avec un an d'arriérés ou plus (règlement, art. 14)

    // --- Activités de l'exercice ---
    private long manifestationsEnAttente;
    private long manifestationsPlanifiees;
    private long manifestationsRealisees;
    private long manifestationsAnnulees;
    private BigDecimal depensesActivites;   // total versé pour les activités de l'exercice

    // --- Graphiques ---
    private List<MonthlyCount> inscriptionsParMois;   // comptes créés
    private List<MonthlyCount> adhesionsParMois;      // adhésions validées (nouveaux adhérents)
    private List<LabelValue> repartitionEtat;         // par état du compte
    private List<LabelValue> repartitionRoles;        // membres actifs par rôle
    private List<LabelValue> repartitionRetards;      // membres actifs par ancienneté d'impayés
    private List<LabelValue> repartitionManifestations; // activités par catégorie
    private List<LabelValueMontant> depensesParCategorie; // coût des activités par catégorie

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MonthlyCount {
        private int month;
        private long count;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LabelValue {
        private String label;
        private long value;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LabelValueMontant {
        private String label;
        private BigDecimal value;
    }
}
