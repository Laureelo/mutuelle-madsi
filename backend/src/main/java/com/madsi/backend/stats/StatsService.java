package com.madsi.backend.stats;

import com.madsi.backend.membres.EligibiliteService;
import com.madsi.backend.settings.SettingsService;
import com.madsi.backend.stats.dto.MembershipStatsDTO;
import com.madsi.backend.stats.dto.TreasuryStatsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Chiffres des tableaux de bord et de l'écran « Statistiques ».
 *
 * Règles de calcul (identiques partout dans l'application) :
 * - la caisse = entrées - sorties des opérations ENREGISTREES, toutes années confondues ;
 * - une opération annulée, ou en attente de confirmation du président, ne compte pas ;
 * - les flux (entrées, sorties, graphiques) sont ceux de l'exercice choisi ;
 * - « en retard » = échéance de prêt dépassée dont il reste quelque chose à payer.
 *
 * Aucune erreur n'est masquée : en cas de problème, l'écran affiche une erreur plutôt que des zéros trompeurs.
 */
@Service
@RequiredArgsConstructor
public class StatsService {

    private static final String PERIODE = "yyyy-MM";

    /** Reste à payer d'une échéance (montant dû moins les remboursements enregistrés). */
    private static final String RESTE_ECHEANCE =
            "(e.montant_du - COALESCE((SELECT SUM(r.montant) FROM remboursements r " +
            " WHERE r.echeance_id = e.id AND r.statut = 'ENREGISTRE'), 0))";

    private final JdbcTemplate jdbc;
    private final EligibiliteService eligibilite;
    private final SettingsService settings;

    // Compteur de rafraîchissement : les écrans peuvent le consulter pour savoir quand recharger.
    private final AtomicLong refreshCounter = new AtomicLong(0);

    public void notifyRefresh() {
        refreshCounter.incrementAndGet();
    }

    public long getRefreshCounter() {
        return refreshCounter.get();
    }

    // ==================================================================
    // Trésorerie
    // ==================================================================

    public TreasuryStatsDTO treasury(int year) {
        LocalDate today = LocalDate.now();
        Date debut = Date.valueOf(LocalDate.of(year, 1, 1));
        Date fin = Date.valueOf(LocalDate.of(year + 1, 1, 1));
        Date aujourdhui = Date.valueOf(today);

        final String solde = "COALESCE(SUM(CASE WHEN sens = 'ENTREE' THEN montant ELSE -montant END), 0)";
        BigDecimal soldeCaisse = decimal("SELECT " + solde + " FROM operations WHERE statut = 'ENREGISTREE'");
        BigDecimal soldeDebut = decimal("SELECT " + solde + " FROM operations WHERE statut = 'ENREGISTREE' AND date_op < ?::date", debut);
        BigDecimal soldeFin = decimal("SELECT " + solde + " FROM operations WHERE statut = 'ENREGISTREE' AND date_op < ?::date", fin);

        // --- Flux par mois, avec le solde de la caisse à la fin de chaque mois ---
        BigDecimal[] entrees = zeros(13);
        BigDecimal[] sorties = zeros(13);
        jdbc.query("SELECT EXTRACT(MONTH FROM date_op)::int AS m, " +
                        "COALESCE(SUM(CASE WHEN sens = 'ENTREE' THEN montant END), 0) AS e, " +
                        "COALESCE(SUM(CASE WHEN sens = 'SORTIE' THEN montant END), 0) AS s " +
                        "FROM operations WHERE statut = 'ENREGISTREE' AND date_op >= ?::date AND date_op < ?::date GROUP BY 1",
                rs -> {
                    int m = rs.getInt("m");
                    entrees[m] = rs.getBigDecimal("e");
                    sorties[m] = rs.getBigDecimal("s");
                }, debut, fin);

        List<TreasuryStatsDTO.MonthlyCashflow> flux = new ArrayList<>();
        BigDecimal courant = soldeDebut;
        BigDecimal totalEntrees = BigDecimal.ZERO;
        BigDecimal totalSorties = BigDecimal.ZERO;
        for (int m = 1; m <= 12; m++) {
            courant = courant.add(entrees[m]).subtract(sorties[m]);
            totalEntrees = totalEntrees.add(entrees[m]);
            totalSorties = totalSorties.add(sorties[m]);
            boolean futur = YearMonth.of(year, m).isAfter(YearMonth.from(today));
            flux.add(TreasuryStatsDTO.MonthlyCashflow.builder()
                    .month(m).entrees(entrees[m]).sorties(sorties[m]).solde(futur ? null : courant).build());
        }

        // --- D'où vient l'argent, où va-t-il ---
        List<TreasuryStatsDTO.LabelValue> origines = labels(
                "SELECT CASE " +
                "  WHEN type_op = 'COTISATION' THEN 'Cotisations' " +
                "  WHEN type_op = 'APPORT' AND objet_type = 'adhesion' THEN 'Droits d''adhésion' " +
                "  WHEN type_op = 'REMBOURSEMENT_PRET' THEN 'Remboursements de prêts' " +
                "  WHEN type_op = 'RECETTE' THEN 'Recettes' " +
                "  ELSE 'Apports et dons' END AS label, SUM(montant) AS v " +
                "FROM operations WHERE statut = 'ENREGISTREE' AND sens = 'ENTREE' AND date_op >= ?::date AND date_op < ?::date " +
                "GROUP BY 1 ORDER BY 2 DESC", debut, fin);
        List<TreasuryStatsDTO.LabelValue> destinations = labels(
                "SELECT CASE " +
                "  WHEN objet_type = 'pret' THEN 'Prêts versés' " +
                "  WHEN objet_type = 'manifestation' THEN 'Prestations et activités' " +
                "  ELSE 'Autres dépenses' END AS label, SUM(montant) AS v " +
                "FROM operations WHERE statut = 'ENREGISTREE' AND sens = 'SORTIE' AND date_op >= ?::date AND date_op < ?::date " +
                "GROUP BY 1 ORDER BY 2 DESC", debut, fin);

        BigDecimal cotisations = valeur(origines, "Cotisations");
        BigDecimal adhesions = valeur(origines, "Droits d'adhésion");
        BigDecimal remboursements = valeur(origines, "Remboursements de prêts");
        BigDecimal pretsVerses = valeur(destinations, "Prêts versés");
        BigDecimal prestations = valeur(destinations, "Prestations et activités");

        List<TreasuryStatsDTO.LabelValue> parType = labels(
                "SELECT type_op AS label, SUM(montant) AS v FROM operations " +
                "WHERE statut = 'ENREGISTREE' AND date_op >= ?::date AND date_op < ?::date GROUP BY 1 ORDER BY 2 DESC", debut, fin);

        // --- Plus grosses sorties de l'exercice ---
        List<TreasuryStatsDTO.TopItem> top = jdbc.query(
                "SELECT o.objet_type, o.montant, o.date_op, m.first_name, m.last_name " +
                "FROM operations o LEFT JOIN membres m ON m.id = o.membre_id " +
                "WHERE o.statut = 'ENREGISTREE' AND o.sens = 'SORTIE' AND o.date_op >= ?::date AND o.date_op < ?::date " +
                "ORDER BY o.montant DESC, o.date_op DESC LIMIT 5",
                (rs, i) -> {
                    String objet = rs.getString("objet_type");
                    String nature = "pret".equals(objet) ? "Prêt" : "manifestation".equals(objet) ? "Prestation" : "Dépense";
                    String nom = nomComplet(rs.getString("first_name"), rs.getString("last_name"));
                    String jour = rs.getTimestamp("date_op").toLocalDateTime().toLocalDate()
                            .format(DateTimeFormatter.ofPattern("dd/MM"));
                    return TreasuryStatsDTO.TopItem.builder()
                            .label(nature + (nom.isEmpty() ? "" : " – " + nom) + " (" + jour + ")")
                            .amount(rs.getBigDecimal("montant")).build();
                }, debut, fin);

        // --- Prêts et échéances ---
        long pretsEnCours = count("SELECT COUNT(*) FROM prets WHERE statut = 'EN_COURS'");
        BigDecimal encours = decimal("SELECT COALESCE(SUM(GREATEST(montant_accorde - COALESCE(montant_rembourse, 0), 0)), 0) " +
                "FROM prets WHERE statut = 'EN_COURS'");
        long pretsEnAttente = count("SELECT COUNT(*) FROM prets WHERE statut IN ('DEMANDE', 'APPROUVE')");
        String echeancesOuvertes = "FROM echeances e JOIN prets p ON p.id = e.pret_id " +
                "WHERE p.statut = 'EN_COURS' AND " + RESTE_ECHEANCE + " > 0 ";
        long aujourdHui = count("SELECT COUNT(*) " + echeancesOuvertes + "AND e.date_echeance = ?::date", aujourdhui);
        long enRetard = count("SELECT COUNT(*) " + echeancesOuvertes + "AND e.date_echeance < ?::date", aujourdhui);
        BigDecimal montantRetard = decimal("SELECT COALESCE(SUM(" + RESTE_ECHEANCE + "), 0) " + echeancesOuvertes
                + "AND e.date_echeance < ?::date", aujourdhui);
        long prochains = count("SELECT COUNT(*) " + echeancesOuvertes
                + "AND e.date_echeance > ?::date AND e.date_echeance <= ?::date + 30", aujourdhui, aujourdhui);

        List<TreasuryStatsDTO.LabelValue> parStatut = new ArrayList<>();
        jdbc.query("SELECT statut, COUNT(*) AS n FROM prets GROUP BY statut", rs -> {
            parStatut.add(TreasuryStatsDTO.LabelValue.builder()
                    .label(libellePret(rs.getString("statut"))).value(BigDecimal.valueOf(rs.getLong("n"))).build());
        });
        parStatut.sort(Comparator.comparingInt(l -> ordrePret(l.getLabel())));

        List<TreasuryStatsDTO.Retard> retards = jdbc.query(
                "SELECT m.id, m.first_name, m.last_name, COUNT(*) AS n, SUM(t.reste) AS montant, MAX(?::date - t.date_echeance) AS jours " +
                "FROM (SELECT e.pret_id, e.date_echeance, " + RESTE_ECHEANCE + " AS reste FROM echeances e) t " +
                "JOIN prets p ON p.id = t.pret_id JOIN membres m ON m.id = p.membre_id " +
                "WHERE p.statut = 'EN_COURS' AND t.reste > 0 AND t.date_echeance < ?::date " +
                "GROUP BY m.id, m.first_name, m.last_name ORDER BY SUM(t.reste) DESC, MAX(?::date - t.date_echeance) DESC LIMIT 10",
                (rs, i) -> TreasuryStatsDTO.Retard.builder()
                        .membreId(rs.getLong("id"))
                        .nom(nomComplet(rs.getString("first_name"), rs.getString("last_name")))
                        .echeances(rs.getLong("n"))
                        .montant(rs.getBigDecimal("montant"))
                        .joursMax(rs.getLong("jours")).build(),
                aujourdhui, aujourdhui, aujourdhui);

        // --- Dépenses qui attendent la confirmation du président ---
        long depEnAttente = count("SELECT COUNT(*) FROM operations WHERE statut = 'EN_ATTENTE_CONFIRMATION' AND sens = 'SORTIE'");
        BigDecimal montantDepEnAttente = decimal("SELECT COALESCE(SUM(montant), 0) FROM operations " +
                "WHERE statut = 'EN_ATTENTE_CONFIRMATION' AND sens = 'SORTIE'");

        return TreasuryStatsDTO.builder()
                .year(year)
                .soldeCaisse(soldeCaisse)
                .soldeDebutAnnee(soldeDebut)
                .soldeFinAnnee(soldeFin)
                .totalEntrees(totalEntrees)
                .totalSorties(totalSorties)
                .totalCotisations(cotisations)
                .totalAdhesions(adhesions)
                .totalRemboursements(remboursements)
                .totalPretsVerses(pretsVerses)
                .totalPrestations(prestations)
                .pretsEnCours(pretsEnCours)
                .encoursPrets(encours)
                .pretsEnAttente(pretsEnAttente)
                .echeancesAujourdHui(aujourdHui)
                .echeancesEnRetard(enRetard)
                .montantEnRetard(montantRetard)
                .echeancesProchains30Jours(prochains)
                .depensesEnAttente(depEnAttente)
                .montantDepensesEnAttente(montantDepEnAttente)
                .monthlyCashflow(flux)
                .entreesParOrigine(origines)
                .sortiesParDestination(destinations)
                .pretsParStatut(parStatut)
                .repartitionOperations(parType)
                .topDepenses(top)
                .cotisationsParMois(cotisationsParMois(year, today))
                .retardsRemboursement(retards)
                .build();
    }

    /** Pour chaque mois écoulé : combien de membres actifs avaient réglé leur cotisation. */
    private List<TreasuryStatsDTO.CotisationMois> cotisationsParMois(int year, LocalDate today) {
        BigDecimal mensualite = settings.montantCotisation();
        List<EligibiliteService.MembreCouverture> actifs = eligibilite.actifsAvecCouverture();
        YearMonth courant = YearMonth.from(today);
        List<TreasuryStatsDTO.CotisationMois> out = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            YearMonth ym = YearMonth.of(year, m);
            if (ym.isAfter(courant)) {
                out.add(TreasuryStatsDTO.CotisationMois.builder().month(m).payes(0).attendus(0)
                        .montantPaye(BigDecimal.ZERO).montantAttendu(BigDecimal.ZERO).taux(null).build());
                continue;
            }
            String periode = ym.format(DateTimeFormatter.ofPattern(PERIODE));
            long attendus = 0;
            long payes = 0;
            for (EligibiliteService.MembreCouverture mc : actifs) {
                if (YearMonth.from(mc.debut()).isAfter(ym)) continue;
                attendus++;
                if (mc.couverts().contains(periode)) payes++;
            }
            out.add(TreasuryStatsDTO.CotisationMois.builder()
                    .month(m).payes(payes).attendus(attendus)
                    .montantPaye(mensualite.multiply(BigDecimal.valueOf(payes)))
                    .montantAttendu(mensualite.multiply(BigDecimal.valueOf(attendus)))
                    .taux(attendus == 0 ? null : arrondi(100.0 * payes / attendus)).build());
        }
        return out;
    }

    // ==================================================================
    // Membres, cotisations et activités
    // ==================================================================

    public MembershipStatsDTO membership(int year) {
        Date debut = Date.valueOf(LocalDate.of(year, 1, 1));
        Date fin = Date.valueOf(LocalDate.of(year + 1, 1, 1));

        // --- Membres ---
        Map<String, Long> parEtat = new HashMap<>();
        jdbc.query("SELECT etat_compte, COUNT(*) AS n FROM membres GROUP BY etat_compte",
                rs -> { parEtat.put(rs.getString("etat_compte"), rs.getLong("n")); });
        long actifs = parEtat.getOrDefault("ACTIF", 0L);
        long inactifs = parEtat.getOrDefault("INACTIF", 0L);
        long visiteurs = parEtat.getOrDefault("VISITEUR", 0L);
        long enAttente = parEtat.getOrDefault("EN_ATTENTE", 0L);
        long valides = parEtat.getOrDefault("VALIDE_PAR_TRESORERIE", 0L);
        long total = parEtat.values().stream().mapToLong(Long::longValue).sum();

        List<MembershipStatsDTO.LabelValue> etats = new ArrayList<>();
        ajouter(etats, "Actifs", actifs);
        ajouter(etats, "Adhésion validée par la trésorerie", valides);
        ajouter(etats, "Inscription en attente", enAttente);
        ajouter(etats, "Visiteurs", visiteurs);
        ajouter(etats, "Inactifs", inactifs);

        List<MembershipStatsDTO.LabelValue> roles = new ArrayList<>();
        jdbc.query("SELECT role, COUNT(*) AS n FROM membres WHERE etat_compte = 'ACTIF' GROUP BY role", rs -> {
            roles.add(MembershipStatsDTO.LabelValue.builder()
                    .label(libelleRole(rs.getString("role"))).value(rs.getLong("n")).build());
        });
        roles.sort(Comparator.comparingLong(MembershipStatsDTO.LabelValue::getValue).reversed());

        // --- Cotisations des membres actifs ---
        long aJour = 0, retard = 0, avertissements = 0;
        long[] tranches = new long[4]; // à jour, 1-3 mois, 4-11 mois, 12 mois et plus
        BigDecimal mensualite = settings.montantCotisation();
        long moisImpayesTotal = 0;
        for (EligibiliteService.MembreCouverture mc : eligibilite.actifsAvecCouverture()) {
            int n = mc.moisImpayes().size();
            moisImpayesTotal += n;
            if (n == 0) { aJour++; tranches[0]++; }
            else {
                retard++;
                if (n < 4) tranches[1]++;
                else if (n < EligibiliteService.MOIS_AVERTISSEMENT) tranches[2]++;
                else { tranches[3]++; avertissements++; }
            }
        }
        long suivis = aJour + retard;
        List<MembershipStatsDTO.LabelValue> retards = List.of(
                MembershipStatsDTO.LabelValue.builder().label("À jour").value(tranches[0]).build(),
                MembershipStatsDTO.LabelValue.builder().label("1 à 3 mois").value(tranches[1]).build(),
                MembershipStatsDTO.LabelValue.builder().label("4 à 11 mois").value(tranches[2]).build(),
                MembershipStatsDTO.LabelValue.builder().label("1 an ou plus").value(tranches[3]).build());

        // --- Nouveaux comptes et nouveaux adhérents par mois ---
        List<MembershipStatsDTO.MonthlyCount> inscriptions = mensuel(
                "SELECT EXTRACT(MONTH FROM date_registered)::int AS m, COUNT(*) AS n FROM membres " +
                "WHERE date_registered >= ?::date AND date_registered < ?::date GROUP BY 1", debut, fin);
        List<MembershipStatsDTO.MonthlyCount> adhesions = mensuel(
                "SELECT EXTRACT(MONTH FROM date_adhesion)::int AS m, COUNT(*) AS n FROM membres " +
                "WHERE date_adhesion >= ?::date AND date_adhesion < ?::date GROUP BY 1", debut, fin);

        // --- Activités (manifestations) de l'exercice ---
        Map<String, Long> parStatut = new HashMap<>();
        jdbc.query("SELECT statut, COUNT(*) AS n FROM manifestations WHERE date >= ?::date AND date < ?::date GROUP BY statut",
                rs -> { parStatut.put(rs.getString("statut"), rs.getLong("n")); }, debut, fin);

        List<MembershipStatsDTO.LabelValue> parCategorie = new ArrayList<>();
        jdbc.query("SELECT COALESCE(t.type, 'AUTRE') AS cat, COUNT(*) AS n FROM manifestations ma " +
                        "LEFT JOIN types_activite t ON t.id = ma.type_activite_id " +
                        "WHERE ma.date >= ?::date AND ma.date < ?::date AND ma.statut IN ('PLANIFIEE', 'REALISEE') " +
                        "GROUP BY 1 ORDER BY 2 DESC",
                rs -> {
                    parCategorie.add(MembershipStatsDTO.LabelValue.builder()
                            .label(libelleCategorie(rs.getString("cat"))).value(rs.getLong("n")).build());
                }, debut, fin);

        List<MembershipStatsDTO.LabelValueMontant> coutCategorie = new ArrayList<>();
        BigDecimal[] coutTotal = {BigDecimal.ZERO};
        jdbc.query("SELECT COALESCE(t.type, 'AUTRE') AS cat, SUM(o.montant) AS v FROM operations o " +
                        "LEFT JOIN manifestations ma ON o.objet_type = 'manifestation' AND ma.id = o.objet_id " +
                        "LEFT JOIN types_activite t ON t.id = ma.type_activite_id " +
                        "WHERE o.statut = 'ENREGISTREE' AND o.sens = 'SORTIE' AND o.objet_type = 'manifestation' " +
                        "AND o.date_op >= ?::date AND o.date_op < ?::date GROUP BY 1 ORDER BY 2 DESC",
                rs -> {
                    BigDecimal v = rs.getBigDecimal("v");
                    coutTotal[0] = coutTotal[0].add(v);
                    coutCategorie.add(MembershipStatsDTO.LabelValueMontant.builder()
                            .label(libelleCategorie(rs.getString("cat"))).value(v).build());
                }, debut, fin);

        return MembershipStatsDTO.builder()
                .year(year)
                .totalMembres(total)
                .membresActifs(actifs)
                .membresEnAttente(enAttente + valides)
                .membresInactifs(inactifs)
                .visiteurs(visiteurs)
                .membresAJour(aJour)
                .membresEnRetard(retard)
                .tauxAJour(suivis == 0 ? null : arrondi(100.0 * aJour / suivis))
                .montantImpaye(mensualite.multiply(BigDecimal.valueOf(moisImpayesTotal)))
                .avertissementsPossibles(avertissements)
                .manifestationsEnAttente(parStatut.getOrDefault("EN_ATTENTE", 0L))
                .manifestationsPlanifiees(parStatut.getOrDefault("PLANIFIEE", 0L))
                .manifestationsRealisees(parStatut.getOrDefault("REALISEE", 0L))
                .manifestationsAnnulees(parStatut.getOrDefault("ANNULEE", 0L))
                .depensesActivites(coutTotal[0])
                .inscriptionsParMois(inscriptions)
                .adhesionsParMois(adhesions)
                .repartitionEtat(etats)
                .repartitionRoles(roles)
                .repartitionRetards(retards)
                .repartitionManifestations(parCategorie)
                .depensesParCategorie(coutCategorie)
                .build();
    }

    // ==================================================================
    // Outils
    // ==================================================================

    private BigDecimal decimal(String sql, Object... args) {
        BigDecimal v = jdbc.queryForObject(sql, BigDecimal.class, args);
        return v == null ? BigDecimal.ZERO : v;
    }

    private long count(String sql, Object... args) {
        Long v = jdbc.queryForObject(sql, Long.class, args);
        return v == null ? 0L : v;
    }

    private static BigDecimal[] zeros(int n) {
        BigDecimal[] t = new BigDecimal[n];
        Arrays.fill(t, BigDecimal.ZERO);
        return t;
    }

    private List<TreasuryStatsDTO.LabelValue> labels(String sql, Object... args) {
        return jdbc.query(sql, (rs, i) -> TreasuryStatsDTO.LabelValue.builder()
                .label(rs.getString("label")).value(rs.getBigDecimal("v")).build(), args);
    }

    private static BigDecimal valeur(List<TreasuryStatsDTO.LabelValue> l, String label) {
        return l.stream().filter(x -> label.equals(x.getLabel())).map(TreasuryStatsDTO.LabelValue::getValue)
                .findFirst().orElse(BigDecimal.ZERO);
    }

    private static void ajouter(List<MembershipStatsDTO.LabelValue> l, String label, long v) {
        if (v > 0) l.add(MembershipStatsDTO.LabelValue.builder().label(label).value(v).build());
    }

    private List<MembershipStatsDTO.MonthlyCount> mensuel(String sql, Object... args) {
        long[] par = new long[13];
        jdbc.query(sql, rs -> { par[rs.getInt("m")] = rs.getLong("n"); }, args);
        List<MembershipStatsDTO.MonthlyCount> out = new ArrayList<>();
        for (int m = 1; m <= 12; m++) out.add(MembershipStatsDTO.MonthlyCount.builder().month(m).count(par[m]).build());
        return out;
    }

    private static double arrondi(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static String nomComplet(String prenom, String nom) {
        return ((prenom == null ? "" : prenom) + " " + (nom == null ? "" : nom)).trim();
    }

    private static String libellePret(String statut) {
        return switch (statut) {
            case "DEMANDE" -> "Demandés";
            case "APPROUVE" -> "Approuvés (à verser)";
            case "EN_COURS" -> "En cours de remboursement";
            case "CLOTURE" -> "Remboursés";
            case "REFUSE" -> "Refusés";
            default -> statut;
        };
    }

    private static int ordrePret(String libelle) {
        return List.of("Demandés", "Approuvés (à verser)", "En cours de remboursement", "Remboursés", "Refusés").indexOf(libelle);
    }

    private static String libelleRole(String role) {
        return switch (role) {
            case "ADMIN" -> "Administrateurs";
            case "TRESORIER" -> "Trésoriers";
            case "COMMISSAIRE" -> "Commissaires aux comptes";
            case "MEMBRE" -> "Membres";
            default -> role;
        };
    }

    private static String libelleCategorie(String cat) {
        return switch (cat) {
            case "MARIAGE" -> "Mariage";
            case "NAISSANCE" -> "Naissance";
            case "MALADIE" -> "Maladie";
            case "RETRAITE" -> "Retraite";
            case "DECES" -> "Décès";
            case "SPORT" -> "Sport";
            case "CULTURE" -> "Culture";
            default -> "Autre";
        };
    }
}
