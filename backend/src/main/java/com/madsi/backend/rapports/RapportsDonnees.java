package com.madsi.backend.rapports;

import com.madsi.backend.membres.EligibiliteService;
import com.madsi.backend.rapports.dto.RapportParamsDTO;
import com.madsi.backend.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Contenu des rapports. Toutes les sommes viennent du même calcul que les écrans de statistiques :
 * seules les opérations ENREGISTREES comptent (ni les annulées, ni celles qui attendent la confirmation du président).
 */
@Component
@RequiredArgsConstructor
public class RapportsDonnees {

    public static final String JOURNAL = "JOURNAL";
    public static final String COTISATIONS = "COTISATIONS";
    public static final String PRETS = "PRETS";
    public static final String MEMBRES = "MEMBRES";
    public static final String ACTIVITES = "ACTIVITES";
    public static final String ANNUEL = "ANNUEL";

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final String[] MOIS = {"janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
            "septembre", "octobre", "novembre", "décembre"};

    private static final String ORIGINE_SQL =
            "CASE WHEN type_op = 'COTISATION' THEN 'Cotisations' " +
            "WHEN type_op = 'APPORT' AND objet_type = 'adhesion' THEN 'Droits d''adhésion' " +
            "WHEN type_op = 'REMBOURSEMENT_PRET' THEN 'Remboursements de prêts' " +
            "WHEN type_op = 'RECETTE' THEN 'Recettes' ELSE 'Apports et dons' END";
    private static final String DESTINATION_SQL =
            "CASE WHEN objet_type = 'pret' THEN 'Prêts versés' " +
            "WHEN objet_type = 'manifestation' THEN 'Prestations et activités' ELSE 'Autres dépenses' END";

    private final JdbcTemplate jdbc;
    private final EligibiliteService eligibilite;
    private final SettingsService settings;

    // ==================================================================
    // Point d'entrée
    // ==================================================================

    public RapportDoc construire(String modele, LocalDate debut, LocalDate fin, RapportParamsDTO.Filtres filtres, String generePar) {
        RapportDoc d = new RapportDoc();
        var org = settings.get().getOrganisation();
        d.organisation = org != null && org.getNom() != null && !org.getNom().isBlank() ? org.getNom() : "MADSI";
        d.genereLe = java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm"));
        d.generePar = generePar == null ? "" : generePar;
        d.periode = (ANNUEL.equals(modele)) ? "Exercice " + debut.getYear()
                : "Période du " + debut.format(JOUR) + " au " + fin.format(JOUR);
        switch (modele) {
            case JOURNAL -> journal(d, debut, fin, filtres);
            case COTISATIONS -> cotisations(d, debut, fin);
            case PRETS -> prets(d, debut, fin);
            case MEMBRES -> membres(d, debut, fin);
            case ACTIVITES -> activites(d, debut, fin);
            case ANNUEL -> annuel(d, debut, fin);
            default -> throw new IllegalArgumentException("Type de rapport inconnu : " + modele);
        }
        return d;
    }

    // ==================================================================
    // 1. Journal de caisse (rapport financier)
    // ==================================================================

    private void journal(RapportDoc d, LocalDate debut, LocalDate fin, RapportParamsDTO.Filtres f) {
        d.titre = "Rapport financier - Journal de caisse";
        Date a = Date.valueOf(debut), b = Date.valueOf(fin.plusDays(1));

        boolean filtre = f != null && (f.membreId() != null || f.sens() != null
                || (f.typesOperation() != null && !f.typesOperation().isEmpty()));
        StringBuilder where = new StringBuilder(" WHERE o.statut = 'ENREGISTREE' AND o.date_op >= ?::date AND o.date_op < ?::date");
        List<Object> args = new ArrayList<>(List.of(a, b));
        if (f != null && f.membreId() != null) { where.append(" AND o.membre_id = ?"); args.add(f.membreId()); }
        if (f != null && f.sens() != null) { where.append(" AND o.sens = ?"); args.add(f.sens().name()); }
        if (f != null && f.typesOperation() != null && !f.typesOperation().isEmpty()) {
            where.append(" AND o.type_op IN (").append(String.join(",", Collections.nCopies(f.typesOperation().size(), "?"))).append(")");
            f.typesOperation().forEach(t -> args.add(t.name()));
        }

        BigDecimal entrees = dec("SELECT COALESCE(SUM(o.montant),0) FROM operations o" + where + " AND o.sens = 'ENTREE'", args.toArray());
        BigDecimal sorties = dec("SELECT COALESCE(SUM(o.montant),0) FROM operations o" + where + " AND o.sens = 'SORTIE'", args.toArray());

        var s = d.section("Situation de la caisse");
        if (filtre) {
            s.note("Rapport filtré : seules les opérations correspondant au filtre choisi sont comptées (pas de solde de caisse).");
            s.info("Total des entrées", fcfa(entrees)).info("Total des sorties", fcfa(sorties)).info("Différence", fcfa(entrees.subtract(sorties)));
        } else {
            BigDecimal ouverture = dec("SELECT COALESCE(SUM(CASE WHEN sens='ENTREE' THEN montant ELSE -montant END),0) FROM operations " +
                    "WHERE statut='ENREGISTREE' AND date_op < ?::date", a);
            s.info("Solde de la caisse au " + debut.minusDays(1).format(JOUR), fcfa(ouverture))
                    .info("+ Entrées de la période", fcfa(entrees))
                    .info("- Sorties de la période", fcfa(sorties))
                    .info("= Solde de la caisse au " + fin.format(JOUR), fcfa(ouverture.add(entrees).subtract(sorties)));
        }

        var te = d.section("Entrées par origine").tableau("Origine", "Nombre", "Montant (FCFA)");
        regrouper(te, "SELECT " + ORIGINE_SQL + " AS lib, COUNT(*) AS n, SUM(montant) AS v FROM operations o" + where + " AND o.sens='ENTREE' GROUP BY 1 ORDER BY 3 DESC", args, entrees);
        var ts = d.section("Sorties par destination").tableau("Destination", "Nombre", "Montant (FCFA)");
        regrouper(ts, "SELECT " + DESTINATION_SQL + " AS lib, COUNT(*) AS n, SUM(montant) AS v FROM operations o" + where + " AND o.sens='SORTIE' GROUP BY 1 ORDER BY 3 DESC", args, sorties);

        var det = d.section("Détail des opérations").tableau("Date", "Nature", "Entrée (FCFA)", "Sortie (FCFA)", "Mode", "Référence", "Membre");
        jdbc.query("SELECT o.date_op, o.type_op, o.objet_type, o.sens, o.montant, o.mode_paiement, o.reference, m.first_name, m.last_name " +
                        "FROM operations o LEFT JOIN membres m ON m.id = o.membre_id" + where + " ORDER BY o.date_op, o.id",
                rs -> {
                    boolean entree = "ENTREE".equals(rs.getString("sens"));
                    BigDecimal v = rs.getBigDecimal("montant");
                    det.ligne(rs.getTimestamp("date_op").toLocalDateTime().toLocalDate().format(JOUR),
                            nature(rs.getString("type_op"), rs.getString("objet_type")),
                            entree ? v : "", entree ? "" : v, mode(rs.getString("mode_paiement")),
                            nz(rs.getString("reference")), nom(rs.getString("first_name"), rs.getString("last_name")));
                }, args.toArray());
        det.vide("Aucune opération enregistrée sur cette période.");
        if (!det.lignes.isEmpty()) det.total("Total", "", entrees, sorties, "", "", "");

        if (!filtre) {
            var info = d.section("Pour information (non comptées ci-dessus)");
            long annulees = lng("SELECT COUNT(*) FROM operations WHERE statut='ANNULEE' AND date_op >= ?::date AND date_op < ?::date", a, b);
            BigDecimal montantAnnulees = dec("SELECT COALESCE(SUM(montant),0) FROM operations WHERE statut='ANNULEE' AND date_op >= ?::date AND date_op < ?::date", a, b);
            long attente = lng("SELECT COUNT(*) FROM operations WHERE statut='EN_ATTENTE_CONFIRMATION' AND sens='SORTIE'");
            BigDecimal montantAttente = dec("SELECT COALESCE(SUM(montant),0) FROM operations WHERE statut='EN_ATTENTE_CONFIRMATION' AND sens='SORTIE'");
            info.info("Opérations annulées sur la période", annulees + " (" + fcfa(montantAnnulees) + ")")
                    .info("Dépenses en attente de confirmation du président (à ce jour)", attente + " (" + fcfa(montantAttente) + ")");
        }
    }

    // ==================================================================
    // 2. Cotisations
    // ==================================================================

    private void cotisations(RapportDoc d, LocalDate debut, LocalDate fin) {
        d.titre = "Rapport des cotisations";
        Date a = Date.valueOf(debut), b = Date.valueOf(fin.plusDays(1));
        BigDecimal total = dec("SELECT COALESCE(SUM(montant),0) FROM operations WHERE type_op='COTISATION' AND statut='ENREGISTREE' AND date_op >= ?::date AND date_op < ?::date", a, b);
        long nb = lng("SELECT COUNT(*) FROM operations WHERE type_op='COTISATION' AND statut='ENREGISTREE' AND date_op >= ?::date AND date_op < ?::date", a, b);

        d.section("Résumé de la période")
                .info("Cotisation mensuelle en vigueur", fcfa(settings.montantCotisation()))
                .info("Paiements de cotisation encaissés", String.valueOf(nb))
                .info("Total encaissé", fcfa(total));

        var mois = d.section("Encaissements par mois").tableau("Mois", "Paiements", "Montant (FCFA)");
        jdbc.query("SELECT to_char(date_op,'YYYY-MM') AS m, COUNT(*) AS n, SUM(montant) AS v FROM operations " +
                        "WHERE type_op='COTISATION' AND statut='ENREGISTREE' AND date_op >= ?::date AND date_op < ?::date GROUP BY 1 ORDER BY 1",
                rs -> { mois.ligne(moisLettres(rs.getString("m")), rs.getLong("n"), rs.getBigDecimal("v")); }, a, b);
        if (!mois.lignes.isEmpty()) mois.total("Total", nb, total);
        mois.vide("Aucune cotisation encaissée sur cette période.");

        var det = d.section("Détail des cotisations encaissées").tableau("Date", "Membre", "Mois couverts", "Montant (FCFA)", "Mode", "Référence");
        jdbc.query("SELECT o.date_op, o.montant, o.mode_paiement, o.reference, m.first_name, m.last_name, c.periodes " +
                        "FROM operations o LEFT JOIN membres m ON m.id = o.membre_id LEFT JOIN cotisations c ON c.operation_id = o.id " +
                        "WHERE o.type_op='COTISATION' AND o.statut='ENREGISTREE' AND o.date_op >= ?::date AND o.date_op < ?::date ORDER BY o.date_op, o.id",
                rs -> {
                    det.ligne(rs.getTimestamp("date_op").toLocalDateTime().toLocalDate().format(JOUR),
                            nom(rs.getString("first_name"), rs.getString("last_name")), periodes(rs.getString("periodes")),
                            rs.getBigDecimal("montant"), mode(rs.getString("mode_paiement")), nz(rs.getString("reference")));
                }, a, b);
        if (!det.lignes.isEmpty()) det.total("Total", "", "", total, "", "");
        det.vide("Aucune cotisation encaissée sur cette période.");

        // Situation d'aujourd'hui
        var arrieres = eligibilite.arrieres();
        long actifs = eligibilite.actifsAvecCouverture().size();
        BigDecimal impaye = arrieres.stream().map(EligibiliteService.Arriere::montantDu).reduce(BigDecimal.ZERO, BigDecimal::add);
        var sit = d.section("Situation des cotisations à ce jour (" + LocalDate.now().format(JOUR) + ")");
        sit.note("Calculée sur les membres actifs, du mois d'adhésion au mois précédent. Un mois déclaré et en attente de validation est considéré comme réglé.");
        sit.info("Membres actifs suivis", String.valueOf(actifs))
                .info("À jour", String.valueOf(actifs - arrieres.size()))
                .info("En retard", String.valueOf(arrieres.size()))
                .info("Total des cotisations impayées", fcfa(impaye));
        var ret = d.section("Membres en retard de cotisation").tableau("Membre", "Mois impayés", "Période", "Montant dû (FCFA)", "Remarque");
        for (var r : arrieres) {
            ret.ligne(r.nom(), r.nombreMois(), moisLettres(r.moisImpayes().get(0)) + " à " + moisLettres(r.moisImpayes().get(r.moisImpayes().size() - 1)),
                    r.montantDu(), r.avertissementPossible() ? "1 an d'arriérés ou plus" : "");
        }
        if (!ret.lignes.isEmpty()) ret.total("Total", arrieres.stream().mapToInt(EligibiliteService.Arriere::nombreMois).sum(), "", impaye, "");
        ret.vide("Tous les membres actifs sont à jour de leurs cotisations.");
    }

    // ==================================================================
    // 3. Prêts
    // ==================================================================

    private void prets(RapportDoc d, LocalDate debut, LocalDate fin) {
        d.titre = "Rapport des prêts et remboursements";
        Date a = Date.valueOf(debut), b = Date.valueOf(fin.plusDays(1));
        final String reste = "(e.montant_du - COALESCE((SELECT SUM(r2.montant) FROM remboursements r2 WHERE r2.echeance_id = e.id AND r2.statut='ENREGISTRE'),0))";

        BigDecimal verses = dec("SELECT COALESCE(SUM(montant_accorde),0) FROM prets WHERE date_decaissement >= ?::date AND date_decaissement < ?::date", a, b);
        long nbVerses = lng("SELECT COUNT(*) FROM prets WHERE date_decaissement >= ?::date AND date_decaissement < ?::date", a, b);
        BigDecimal rembourse = dec("SELECT COALESCE(SUM(r.montant),0) FROM remboursements r WHERE r.statut='ENREGISTRE' AND r.date_paiement >= ?::date AND r.date_paiement < ?::date", a, b);
        long nbRemb = lng("SELECT COUNT(*) FROM remboursements r WHERE r.statut='ENREGISTRE' AND r.date_paiement >= ?::date AND r.date_paiement < ?::date", a, b);

        d.section("Résumé de la période")
                .note("Les prêts de la mutuelle sont sans intérêt : le montant à rembourser est celui qui a été prêté.")
                .info("Prêts versés", nbVerses + " (" + fcfa(verses) + ")")
                .info("Remboursements reçus", nbRemb + " (" + fcfa(rembourse) + ")");

        var tv = d.section("Prêts versés pendant la période").tableau("Date de versement", "Membre", "Montant (FCFA)", "Échéances", "Remboursé (FCFA)", "Reste dû (FCFA)", "Situation");
        jdbc.query("SELECT p.date_decaissement, m.first_name, m.last_name, p.montant_accorde, p.duree_mois, p.statut, COALESCE(p.montant_rembourse,0) AS remb " +
                        "FROM prets p JOIN membres m ON m.id = p.membre_id WHERE p.date_decaissement >= ?::date AND p.date_decaissement < ?::date ORDER BY p.date_decaissement, p.id",
                rs -> {
                    BigDecimal montant = rs.getBigDecimal("montant_accorde"), remb = rs.getBigDecimal("remb");
                    tv.ligne(rs.getDate("date_decaissement").toLocalDate().format(JOUR), nom(rs.getString("first_name"), rs.getString("last_name")),
                            montant, rs.getInt("duree_mois"), remb, montant.subtract(remb).max(BigDecimal.ZERO), statutPret(rs.getString("statut")));
                }, a, b);
        if (!tv.lignes.isEmpty()) tv.total("Total", "", verses, "", "", "", "");
        tv.vide("Aucun prêt versé sur cette période.");

        var tr = d.section("Remboursements reçus pendant la période").tableau("Date", "Membre", "Échéance n°", "Montant (FCFA)", "Mode", "Référence");
        jdbc.query("SELECT r.date_paiement, m.first_name, m.last_name, e.numero, r.montant, r.mode_paiement, r.reference " +
                        "FROM remboursements r JOIN echeances e ON e.id = r.echeance_id JOIN prets p ON p.id = e.pret_id JOIN membres m ON m.id = p.membre_id " +
                        "WHERE r.statut='ENREGISTRE' AND r.date_paiement >= ?::date AND r.date_paiement < ?::date ORDER BY r.date_paiement, r.id",
                rs -> {
                    tr.ligne(rs.getTimestamp("date_paiement").toLocalDateTime().toLocalDate().format(JOUR), nom(rs.getString("first_name"), rs.getString("last_name")),
                            rs.getInt("numero"), rs.getBigDecimal("montant"), mode(rs.getString("mode_paiement")), nz(rs.getString("reference")));
                }, a, b);
        if (!tr.lignes.isEmpty()) tr.total("Total", "", "", rembourse, "", "");
        tr.vide("Aucun remboursement reçu sur cette période.");

        // Situation d'aujourd'hui
        long enCours = lng("SELECT COUNT(*) FROM prets WHERE statut='EN_COURS'");
        BigDecimal encours = dec("SELECT COALESCE(SUM(GREATEST(montant_accorde - COALESCE(montant_rembourse,0),0)),0) FROM prets WHERE statut='EN_COURS'");
        LocalDate auj = LocalDate.now();
        Date jour = Date.valueOf(auj);
        long retardN = lng("SELECT COUNT(*) FROM echeances e JOIN prets p ON p.id = e.pret_id WHERE p.statut='EN_COURS' AND e.date_echeance < ?::date AND " + reste + " > 0", jour);
        BigDecimal retardM = dec("SELECT COALESCE(SUM(" + reste + "),0) FROM echeances e JOIN prets p ON p.id = e.pret_id WHERE p.statut='EN_COURS' AND e.date_echeance < ?::date AND " + reste + " > 0", jour);
        long attente = lng("SELECT COUNT(*) FROM prets WHERE statut IN ('DEMANDE','APPROUVE')");
        d.section("Situation à ce jour (" + auj.format(JOUR) + ")")
                .info("Prêts en cours de remboursement", String.valueOf(enCours))
                .info("Reste à rembourser", fcfa(encours))
                .info("Échéances en retard", retardN + " (" + fcfa(retardM) + ")")
                .info("Demandes en attente de traitement", String.valueOf(attente));

        var tc = d.section("Prêts en cours à ce jour").tableau("Membre", "Accordé (FCFA)", "Remboursé (FCFA)", "Reste dû (FCFA)", "Prochaine échéance", "Retard");
        jdbc.query("SELECT m.first_name, m.last_name, p.montant_accorde, COALESCE(p.montant_rembourse,0) AS remb, " +
                        "(SELECT MIN(e.date_echeance) FROM echeances e WHERE e.pret_id = p.id AND " + reste + " > 0) AS prochaine " +
                        "FROM prets p JOIN membres m ON m.id = p.membre_id WHERE p.statut='EN_COURS' ORDER BY p.date_decaissement, p.id",
                rs -> {
                    BigDecimal montant = rs.getBigDecimal("montant_accorde"), remb = rs.getBigDecimal("remb");
                    java.sql.Date pro = rs.getDate("prochaine");
                    boolean retard = pro != null && pro.toLocalDate().isBefore(auj);
                    tc.ligne(nom(rs.getString("first_name"), rs.getString("last_name")), montant, remb, montant.subtract(remb).max(BigDecimal.ZERO),
                            pro == null ? "-" : pro.toLocalDate().format(JOUR),
                            retard ? java.time.temporal.ChronoUnit.DAYS.between(pro.toLocalDate(), auj) + " jours" : "");
                });
        if (!tc.lignes.isEmpty()) tc.total("Total", tc.lignes.stream().map(l -> (BigDecimal) l.get(1)).reduce(BigDecimal.ZERO, BigDecimal::add),
                tc.lignes.stream().map(l -> (BigDecimal) l.get(2)).reduce(BigDecimal.ZERO, BigDecimal::add), encours, "", "");
        tc.vide("Aucun prêt en cours de remboursement.");
    }

    // ==================================================================
    // 4. Membres
    // ==================================================================

    private void membres(RapportDoc d, LocalDate debut, LocalDate fin) {
        d.titre = "Rapport des membres";
        Date a = Date.valueOf(debut), b = Date.valueOf(fin.plusDays(1));

        Map<String, Long> etats = new HashMap<>();
        jdbc.query("SELECT etat_compte, COUNT(*) AS n FROM membres GROUP BY 1", rs -> { etats.put(rs.getString(1), rs.getLong(2)); });
        long total = etats.values().stream().mapToLong(Long::longValue).sum();
        var arrieres = eligibilite.arrieres();
        long suivis = eligibilite.actifsAvecCouverture().size();
        var sit = d.section("Situation à ce jour (" + LocalDate.now().format(JOUR) + ")");
        sit.info("Comptes au total", String.valueOf(total))
                .info("Membres actifs", String.valueOf(etats.getOrDefault("ACTIF", 0L)))
                .info("En attente de validation", String.valueOf(etats.getOrDefault("EN_ATTENTE", 0L) + etats.getOrDefault("VALIDE_PAR_TRESORERIE", 0L)))
                .info("Visiteurs (inscrits, pas encore adhérents)", String.valueOf(etats.getOrDefault("VISITEUR", 0L)))
                .info("Inactifs", String.valueOf(etats.getOrDefault("INACTIF", 0L)))
                .info("À jour de leurs cotisations", (suivis - arrieres.size()) + " sur " + suivis
                        + (suivis == 0 ? "" : " (" + Math.round(100.0 * (suivis - arrieres.size()) / suivis) + " %)"));

        var roles = d.section("Membres actifs par rôle").tableau("Rôle", "Nombre");
        jdbc.query("SELECT role, COUNT(*) AS n FROM membres WHERE etat_compte='ACTIF' GROUP BY 1 ORDER BY 2 DESC",
                rs -> { roles.ligne(role(rs.getString(1)), rs.getLong(2)); });
        roles.vide("Aucun membre actif.");

        var adh = d.section("Nouveaux adhérents pendant la période").tableau("Date d'adhésion", "Nom", "Prénom", "Fonction", "Matricule");
        jdbc.query("SELECT date_adhesion, last_name, first_name, fonction, matricule FROM membres " +
                        "WHERE date_adhesion >= ?::date AND date_adhesion < ?::date ORDER BY date_adhesion, last_name",
                rs -> { adh.ligne(rs.getDate(1).toLocalDate().format(JOUR), nz(rs.getString(2)), nz(rs.getString(3)), nz(rs.getString(4)), nz(rs.getString(5))); }, a, b);
        if (!adh.lignes.isEmpty()) adh.total("Total : " + adh.lignes.size(), "", "", "", "");
        adh.vide("Aucune adhésion sur cette période.");

        Map<Long, Integer> impayes = new HashMap<>();
        arrieres.forEach(r -> impayes.put(r.membreId(), r.nombreMois()));
        var liste = d.section("Liste des membres actifs").tableau("Nom", "Prénom", "Fonction", "Rôle", "Adhésion", "Mois impayés");
        jdbc.query("SELECT id, last_name, first_name, fonction, role, date_adhesion FROM membres WHERE etat_compte='ACTIF' ORDER BY last_name, first_name",
                rs -> {
                    java.sql.Date ad = rs.getDate("date_adhesion");
                    liste.ligne(nz(rs.getString("last_name")), nz(rs.getString("first_name")), nz(rs.getString("fonction")), role(rs.getString("role")),
                            ad == null ? "-" : ad.toLocalDate().format(JOUR), impayes.getOrDefault(rs.getLong("id"), 0));
                });
        liste.vide("Aucun membre actif.");
    }

    // ==================================================================
    // 5. Activités (manifestations)
    // ==================================================================

    private void activites(RapportDoc d, LocalDate debut, LocalDate fin) {
        d.titre = "Rapport des activités et prestations";
        Date a = Date.valueOf(debut), b = Date.valueOf(fin.plusDays(1));
        final String verse = "COALESCE((SELECT SUM(o.montant) FROM operations o WHERE o.objet_type='manifestation' AND o.objet_id = ma.id " +
                "AND o.sens='SORTIE' AND o.statut='ENREGISTREE'),0)";

        Map<String, Long> parStatut = new HashMap<>();
        jdbc.query("SELECT statut, COUNT(*) FROM manifestations WHERE date >= ?::date AND date < ?::date GROUP BY 1",
                rs -> { parStatut.put(rs.getString(1), rs.getLong(2)); }, a, b);
        BigDecimal versement = dec("SELECT COALESCE(SUM(" + verse + "),0) FROM manifestations ma WHERE ma.date >= ?::date AND ma.date < ?::date", a, b);
        var res = d.section("Résumé de la période");
        res.note("« Versé » = sommes réellement sorties de la caisse pour l'activité (enregistrées dans Opérations, en rattachant la dépense à l'activité).");
        res.info("Demandes en attente de validation", String.valueOf(parStatut.getOrDefault("EN_ATTENTE", 0L)))
                .info("Planifiées", String.valueOf(parStatut.getOrDefault("PLANIFIEE", 0L)))
                .info("Réalisées", String.valueOf(parStatut.getOrDefault("REALISEE", 0L)))
                .info("Annulées ou refusées", String.valueOf(parStatut.getOrDefault("ANNULEE", 0L)))
                .info("Total versé", fcfa(versement));

        var cat = d.section("Par catégorie (activités planifiées et réalisées)").tableau("Catégorie", "Nombre", "Prévu (FCFA)", "Versé (FCFA)");
        jdbc.query("SELECT COALESCE(t.type,'AUTRE') AS cat, COUNT(*) AS n, COALESCE(SUM(ma.montant_prevu),0) AS prevu, SUM(" + verse + ") AS verse " +
                        "FROM manifestations ma LEFT JOIN types_activite t ON t.id = ma.type_activite_id " +
                        "WHERE ma.date >= ?::date AND ma.date < ?::date AND ma.statut IN ('PLANIFIEE','REALISEE') GROUP BY 1 ORDER BY 2 DESC",
                rs -> { cat.ligne(categorie(rs.getString(1)), rs.getLong(2), rs.getBigDecimal(3), rs.getBigDecimal(4)); }, a, b);
        cat.vide("Aucune activité planifiée ou réalisée sur cette période.");

        var det = d.section("Détail des activités").tableau("Date", "Activité", "Catégorie", "Bénéficiaire / organisateur", "Lieu", "Situation", "Prévu (FCFA)", "Versé (FCFA)");
        jdbc.query("SELECT ma.date, ma.libelle, COALESCE(t.type,'AUTRE') AS cat, m.first_name, m.last_name, ma.lieu, ma.statut, ma.montant_prevu, " + verse + " AS verse " +
                        "FROM manifestations ma LEFT JOIN types_activite t ON t.id = ma.type_activite_id LEFT JOIN membres m ON m.id = ma.membre_id " +
                        "WHERE ma.date >= ?::date AND ma.date < ?::date ORDER BY ma.date, ma.id",
                rs -> {
                    BigDecimal prevu = rs.getBigDecimal("montant_prevu");
                    det.ligne(rs.getDate("date").toLocalDate().format(JOUR), nz(rs.getString("libelle")), categorie(rs.getString("cat")),
                            nom(rs.getString("first_name"), rs.getString("last_name")), nz(rs.getString("lieu")), statutActivite(rs.getString("statut")),
                            prevu == null ? "" : prevu, rs.getBigDecimal("verse"));
                }, a, b);
        det.vide("Aucune activité sur cette période.");
        if (!det.lignes.isEmpty()) det.total("Total", "", "", "", "", "", "", versement);
    }

    // ==================================================================
    // 6. Bilan annuel
    // ==================================================================

    private void annuel(RapportDoc d, LocalDate debut, LocalDate fin) {
        int annee = debut.getYear();
        LocalDate dd = LocalDate.of(annee, 1, 1), ff = LocalDate.of(annee, 12, 31);
        d.titre = "Rapport annuel - Bilan de l'exercice " + annee;
        Date a = Date.valueOf(dd), b = Date.valueOf(ff.plusDays(1));

        BigDecimal ouverture = dec("SELECT COALESCE(SUM(CASE WHEN sens='ENTREE' THEN montant ELSE -montant END),0) FROM operations WHERE statut='ENREGISTREE' AND date_op < ?::date", a);
        BigDecimal entrees = dec("SELECT COALESCE(SUM(montant),0) FROM operations WHERE statut='ENREGISTREE' AND sens='ENTREE' AND date_op >= ?::date AND date_op < ?::date", a, b);
        BigDecimal sorties = dec("SELECT COALESCE(SUM(montant),0) FROM operations WHERE statut='ENREGISTREE' AND sens='SORTIE' AND date_op >= ?::date AND date_op < ?::date", a, b);

        d.section("1. La caisse")
                .info("Solde au 1er janvier " + annee, fcfa(ouverture))
                .info("+ Entrées de l'année", fcfa(entrees))
                .info("- Sorties de l'année", fcfa(sorties))
                .info("= Solde au 31 décembre " + annee + (annee == LocalDate.now().getYear() ? " (à ce jour)" : ""), fcfa(ouverture.add(entrees).subtract(sorties)));

        List<Object> args = List.of(a, b);
        String w = " WHERE o.statut='ENREGISTREE' AND o.date_op >= ?::date AND o.date_op < ?::date";
        var te = d.section("2. D'où vient l'argent").tableau("Origine", "Nombre", "Montant (FCFA)");
        regrouper(te, "SELECT " + ORIGINE_SQL + " AS lib, COUNT(*) AS n, SUM(montant) AS v FROM operations o" + w + " AND o.sens='ENTREE' GROUP BY 1 ORDER BY 3 DESC", args, entrees);
        var ts = d.section("3. Où va l'argent").tableau("Destination", "Nombre", "Montant (FCFA)");
        regrouper(ts, "SELECT " + DESTINATION_SQL + " AS lib, COUNT(*) AS n, SUM(montant) AS v FROM operations o" + w + " AND o.sens='SORTIE' GROUP BY 1 ORDER BY 3 DESC", args, sorties);

        var mois = d.section("4. Mois par mois").tableau("Mois", "Entrées (FCFA)", "Sorties (FCFA)", "Solde en fin de mois (FCFA)");
        BigDecimal[] e = new BigDecimal[13], s = new BigDecimal[13];
        Arrays.fill(e, BigDecimal.ZERO);
        Arrays.fill(s, BigDecimal.ZERO);
        jdbc.query("SELECT EXTRACT(MONTH FROM date_op)::int AS m, COALESCE(SUM(CASE WHEN sens='ENTREE' THEN montant END),0) AS e, " +
                        "COALESCE(SUM(CASE WHEN sens='SORTIE' THEN montant END),0) AS s FROM operations WHERE statut='ENREGISTREE' AND date_op >= ?::date AND date_op < ?::date GROUP BY 1",
                rs -> { e[rs.getInt(1)] = rs.getBigDecimal(2); s[rs.getInt(1)] = rs.getBigDecimal(3); }, a, b);
        BigDecimal solde = ouverture;
        for (int m = 1; m <= 12; m++) {
            solde = solde.add(e[m]).subtract(s[m]);
            mois.ligne(capitaliser(MOIS[m - 1]), e[m], s[m], solde);
        }
        mois.total("Année " + annee, entrees, sorties, solde);

        // Cotisations
        BigDecimal cot = dec("SELECT COALESCE(SUM(montant),0) FROM operations WHERE type_op='COTISATION' AND statut='ENREGISTREE' AND date_op >= ?::date AND date_op < ?::date", a, b);
        var arrieres = eligibilite.arrieres();
        long suivis = eligibilite.actifsAvecCouverture().size();
        d.section("5. Cotisations")
                .info("Cotisations encaissées en " + annee, fcfa(cot))
                .info("Membres à jour (à ce jour)", (suivis - arrieres.size()) + " sur " + suivis)
                .info("Cotisations impayées (à ce jour)", fcfa(arrieres.stream().map(EligibiliteService.Arriere::montantDu).reduce(BigDecimal.ZERO, BigDecimal::add)));

        // Prêts
        BigDecimal verses = dec("SELECT COALESCE(SUM(montant_accorde),0) FROM prets WHERE date_decaissement >= ?::date AND date_decaissement < ?::date", a, b);
        long nbVerses = lng("SELECT COUNT(*) FROM prets WHERE date_decaissement >= ?::date AND date_decaissement < ?::date", a, b);
        BigDecimal remb = dec("SELECT COALESCE(SUM(montant),0) FROM remboursements WHERE statut='ENREGISTRE' AND date_paiement >= ?::date AND date_paiement < ?::date", a, b);
        BigDecimal encours = dec("SELECT COALESCE(SUM(GREATEST(montant_accorde - COALESCE(montant_rembourse,0),0)),0) FROM prets WHERE statut='EN_COURS'");
        d.section("6. Prêts")
                .info("Prêts versés en " + annee, nbVerses + " (" + fcfa(verses) + ")")
                .info("Remboursements reçus en " + annee, fcfa(remb))
                .info("Reste à rembourser (à ce jour)", fcfa(encours));

        // Membres
        long actifs = lng("SELECT COUNT(*) FROM membres WHERE etat_compte='ACTIF'");
        long nouveaux = lng("SELECT COUNT(*) FROM membres WHERE date_adhesion >= ?::date AND date_adhesion < ?::date", a, b);
        d.section("7. Membres")
                .info("Membres actifs (à ce jour)", String.valueOf(actifs))
                .info("Nouveaux adhérents en " + annee, String.valueOf(nouveaux));

        // Activités
        var act = d.section("8. Activités et prestations").tableau("Catégorie", "Nombre", "Versé (FCFA)");
        BigDecimal[] totalVerse = {BigDecimal.ZERO};
        long[] nbAct = {0};
        jdbc.query("SELECT COALESCE(t.type,'AUTRE') AS cat, COUNT(*) AS n, COALESCE(SUM((SELECT SUM(o.montant) FROM operations o WHERE o.objet_type='manifestation' " +
                        "AND o.objet_id = ma.id AND o.sens='SORTIE' AND o.statut='ENREGISTREE')),0) AS verse " +
                        "FROM manifestations ma LEFT JOIN types_activite t ON t.id = ma.type_activite_id " +
                        "WHERE ma.date >= ?::date AND ma.date < ?::date AND ma.statut IN ('PLANIFIEE','REALISEE') GROUP BY 1 ORDER BY 2 DESC",
                rs -> {
                    act.ligne(categorie(rs.getString(1)), rs.getLong(2), rs.getBigDecimal(3));
                    nbAct[0] += rs.getLong(2);
                    totalVerse[0] = totalVerse[0].add(rs.getBigDecimal(3));
                }, a, b);
        if (!act.lignes.isEmpty()) act.total("Total", nbAct[0], totalVerse[0]);
        act.vide("Aucune activité planifiée ou réalisée en " + annee + ".");
    }

    // ==================================================================
    // Outils
    // ==================================================================

    private void regrouper(RapportDoc.Tableau t, String sql, List<Object> args, BigDecimal total) {
        long[] n = {0};
        jdbc.query(sql, rs -> {
            t.ligne(rs.getString("lib"), rs.getLong("n"), rs.getBigDecimal("v"));
            n[0] += rs.getLong("n");
        }, args.toArray());
        if (!t.lignes.isEmpty()) t.total("Total", n[0], total);
        t.vide("Aucune opération sur cette période.");
    }

    private BigDecimal dec(String sql, Object... args) {
        BigDecimal v = jdbc.queryForObject(sql, BigDecimal.class, args);
        return v == null ? BigDecimal.ZERO : v;
    }

    private long lng(String sql, Object... args) {
        Long v = jdbc.queryForObject(sql, Long.class, args);
        return v == null ? 0L : v;
    }

    static String fcfa(BigDecimal v) {
        return RapportRendu.nombre(v) + " FCFA";
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String nom(String prenom, String nom) {
        String s = ((prenom == null ? "" : prenom) + " " + (nom == null ? "" : nom)).trim();
        return s.isEmpty() ? "-" : s;
    }

    private static String mode(String m) {
        if (m == null) return "-";
        return switch (m) {
            case "ESPECES" -> "Espèces";
            case "MOBILE_MONEY" -> "Mobile Money";
            default -> m;
        };
    }

    private static String nature(String type, String objet) {
        if (type == null) return "-";
        return switch (type) {
            case "COTISATION" -> "Cotisation";
            case "APPORT" -> "adhesion".equals(objet) ? "Droit d'adhésion" : "Apport";
            case "RECETTE" -> "Recette";
            case "REMBOURSEMENT_PRET" -> "Remboursement de prêt";
            case "DEPENSE" -> "pret".equals(objet) ? "Prêt versé" : "manifestation".equals(objet) ? "Prestation / activité" : "Dépense";
            default -> type;
        };
    }

    private static String statutPret(String s) {
        return switch (s) {
            case "EN_COURS" -> "En cours";
            case "CLOTURE" -> "Remboursé";
            case "APPROUVE" -> "Approuvé";
            case "DEMANDE" -> "Demandé";
            case "REFUSE" -> "Refusé";
            default -> s;
        };
    }

    private static String statutActivite(String s) {
        return switch (s) {
            case "EN_ATTENTE" -> "En attente";
            case "PLANIFIEE" -> "Planifiée";
            case "REALISEE" -> "Réalisée";
            case "ANNULEE" -> "Annulée / refusée";
            default -> s;
        };
    }

    private static String role(String r) {
        return switch (r) {
            case "ADMIN" -> "Administrateur";
            case "TRESORIER" -> "Trésorier";
            case "COMMISSAIRE" -> "Commissaire aux comptes";
            case "MEMBRE" -> "Membre";
            default -> r;
        };
    }

    private static String categorie(String c) {
        return switch (c) {
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

    private static String capitaliser(String s) {
        return s.substring(0, 1).toUpperCase() + s.substring(1);
    }

    /** « 2026-07 » devient « juillet 2026 ». */
    private static String moisLettres(String periode) {
        try {
            String[] p = periode.trim().split("-");
            return MOIS[Integer.parseInt(p[1]) - 1] + " " + p[0];
        } catch (Exception e) {
            return periode;
        }
    }

    /** Liste « 2026-01,2026-02,2026-03 » résumée : « janvier 2026 à mars 2026 (3 mois) ». */
    private static String periodes(String p) {
        if (p == null || p.isBlank()) return "-";
        String[] l = p.split(",");
        if (l.length == 1) return moisLettres(l[0]);
        return moisLettres(l[0]) + " à " + moisLettres(l[l.length - 1]) + " (" + l.length + " mois)";
    }
}
