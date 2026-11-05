package com.madsi.backend.stats.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

/**
 * Statistiques de trésorerie d'un exercice (année civile).
 * Seules les opérations ENREGISTREES comptent : les opérations annulées ou en attente de confirmation du président
 * n'ont pas bougé la caisse.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TreasuryStatsDTO {
    private int year;

    // --- Caisse ---
    private BigDecimal soldeCaisse;        // argent en caisse AUJOURD'HUI (toutes années confondues)
    private BigDecimal soldeDebutAnnee;    // caisse au 1er janvier de l'exercice
    private BigDecimal soldeFinAnnee;      // caisse au 31 décembre de l'exercice (ou aujourd'hui si l'année n'est pas finie)

    // --- Flux de l'exercice ---
    private BigDecimal totalEntrees;
    private BigDecimal totalSorties;
    private BigDecimal totalCotisations;
    private BigDecimal totalAdhesions;       // droits d'adhésion
    private BigDecimal totalRemboursements;  // remboursements de prêts reçus
    private BigDecimal totalPretsVerses;     // prêts décaissés
    private BigDecimal totalPrestations;     // prestations et activités (manifestations)

    // --- Prêts ---
    private long pretsEnCours;
    private BigDecimal encoursPrets;         // ce que les membres doivent encore à la mutuelle
    private long pretsEnAttente;             // demandes à traiter (demandés ou approuvés)
    private long echeancesAujourdHui;
    private long echeancesEnRetard;
    private BigDecimal montantEnRetard;
    private long echeancesProchains30Jours;

    // --- Dépenses à confirmer par le président ---
    private long depensesEnAttente;
    private BigDecimal montantDepensesEnAttente;

    // --- Graphiques ---
    private List<MonthlyCashflow> monthlyCashflow;     // 12 points (janvier à décembre)
    private List<LabelValue> entreesParOrigine;        // d'où vient l'argent
    private List<LabelValue> sortiesParDestination;    // où va l'argent
    private List<LabelValue> pretsParStatut;
    private List<LabelValue> repartitionOperations;    // par type d'opération (compatibilité)
    private List<TopItem> topDepenses;                 // les 5 plus grosses sorties de l'exercice
    private List<CotisationMois> cotisationsParMois;   // taux de membres à jour, mois par mois
    private List<Retard> retardsRemboursement;         // membres en retard de remboursement

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MonthlyCashflow {
        private int month;            // 1..12
        private BigDecimal entrees;
        private BigDecimal sorties;
        private BigDecimal solde;     // solde de la caisse en fin de mois (null pour les mois à venir)
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LabelValue {
        private String label;
        private BigDecimal value;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TopItem {
        private String label;
        private BigDecimal amount;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CotisationMois {
        private int month;
        private long payes;       // membres qui ont réglé ce mois
        private long attendus;    // membres devant cotiser ce mois
        private BigDecimal montantPaye;
        private BigDecimal montantAttendu;
        private Double taux;      // pourcentage 0..100 (null si personne n'est attendu)
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Retard {
        private Long membreId;
        private String nom;
        private long echeances;
        private BigDecimal montant;
        private long joursMax;
    }
}
