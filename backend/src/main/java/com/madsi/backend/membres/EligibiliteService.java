package com.madsi.backend.membres;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.cotisations.Cotisation;
import com.madsi.backend.cotisations.CotisationRepository;
import com.madsi.backend.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Règles d'éligibilité tirées du règlement intérieur de la MADSI :
 * - art. 11 : les avantages (prestations, prêts) sont réservés aux membres « à jour de leur cotisation » ;
 * - art. 18 : le non-paiement des cotisations entraîne la déchéance des droits ;
 * - art. 14 : un an d'arriérés de cotisation entraîne un avertissement.
 *
 * Un mois est dû à partir du mois d'adhésion jusqu'au mois PRÉCÉDENT inclus (le mois en cours n'est pas encore en retard).
 * Un mois compte comme réglé s'il est couvert par une cotisation validée (PAYE) ou déclarée en attente de validation
 * (le membre a fait sa part ; le retard éventuel du trésorier ne le pénalise pas).
 *
 * Cette classe est la SEULE source de vérité pour « qui doit combien de mois » : prêts, prestations,
 * statistiques et écran des relances s'appuient tous sur elle.
 */
@Service
@RequiredArgsConstructor
public class EligibiliteService {

    private static final DateTimeFormatter PERIODE = DateTimeFormatter.ofPattern("yyyy-MM");
    /** Un an d'arriérés entraîne un avertissement (règlement intérieur, art. 14). */
    public static final int MOIS_AVERTISSEMENT = 12;

    private final MembreRepository membreRepo;
    private final CotisationRepository cotisationRepo;
    private final SettingsService settingsService;

    // ------------------------------------------------------------------
    // Calcul de base
    // ------------------------------------------------------------------

    /** Premier mois dû : le mois d'adhésion (null si le membre n'est pas encore adhérent). */
    public static LocalDate debutCotisation(Membre m) {
        if (m.getDateAdhesion() != null) return m.getDateAdhesion();
        if (m.getDateValidated() != null) return m.getDateValidated().toLocalDate();
        return null;
    }

    /** Dernier mois dû : le mois précédent. */
    public static YearMonth dernierMoisDu() {
        return YearMonth.now().minusMonths(1);
    }

    /** Mois dus (du premier au dernier) qui ne sont pas couverts par les cotisations du membre. */
    public static List<String> calculerMoisImpayes(LocalDate debut, Set<String> couverts, YearMonth dernier) {
        if (debut == null) return List.of();
        YearMonth premier = YearMonth.from(debut);
        if (premier.isAfter(dernier)) return List.of();
        List<String> manquants = new ArrayList<>();
        for (YearMonth ym = premier; !ym.isAfter(dernier); ym = ym.plusMonths(1)) {
            String p = ym.format(PERIODE);
            if (!couverts.contains(p)) manquants.add(p);
        }
        return manquants;
    }

    /** Périodes couvertes par une cotisation validée ou en attente de validation. */
    private static void ajouterCouverture(Cotisation c, Set<String> couverts) {
        if (c.getStatut() != Enums.CotiStatut.PAYE && c.getStatut() != Enums.CotiStatut.EN_ATTENTE) return;
        if (c.getPeriodes() == null) return;
        for (String p : c.getPeriodes().split(",")) couverts.add(p.trim());
    }

    // ------------------------------------------------------------------
    // Un membre
    // ------------------------------------------------------------------

    /** Mois (AAAA-MM) dus et non réglés, du plus ancien au plus récent. */
    public List<String> moisImpayes(Long membreId) {
        Membre m = membreRepo.findById(membreId)
                .orElseThrow(() -> new NotFoundException("Membre introuvable"));
        Set<String> couverts = new HashSet<>();
        for (Cotisation c : cotisationRepo.findByMembreIdOrderByPeriodeDesc(membreId)) ajouterCouverture(c, couverts);
        return calculerMoisImpayes(debutCotisation(m), couverts, dernierMoisDu());
    }

    /** Nombre de mois de cotisation impayés. */
    public int nombreMoisImpayes(Long membreId) {
        return moisImpayes(membreId).size();
    }

    /** Montant des cotisations impayées (mois impayés x cotisation mensuelle). */
    public BigDecimal montantImpaye(Long membreId) {
        return settingsService.montantCotisation().multiply(BigDecimal.valueOf(nombreMoisImpayes(membreId)));
    }

    /**
     * Lève une exception explicite si le membre n'est pas à jour (sauf si l'option est désactivée dans les Paramètres).
     *
     * @param pour ce que le membre voulait obtenir (ex. « un prêt », « cette prestation »)
     */
    public void exigerAJour(Long membreId, String pour) {
        if (!settingsService.exigerCotisationsAJour()) return;
        List<String> impayes = moisImpayes(membreId);
        if (impayes.isEmpty()) return;
        String liste = impayes.size() <= 4
                ? String.join(", ", impayes)
                : impayes.get(0) + " ... " + impayes.get(impayes.size() - 1);
        throw new IllegalStateException("Impossible d'obtenir " + pour + " : le membre n'est pas à jour de ses cotisations ("
                + impayes.size() + " mois impayé(s) : " + liste + "). Règlement intérieur, art. 11 et 18.");
    }

    // ------------------------------------------------------------------
    // Tous les membres actifs (en lot : une seule lecture des cotisations)
    // ------------------------------------------------------------------

    /** Membre actif avec les mois de cotisation qu'il a réglés. */
    public record MembreCouverture(Membre membre, LocalDate debut, Set<String> couverts) {
        public List<String> moisImpayes() {
            return calculerMoisImpayes(debut, couverts, dernierMoisDu());
        }
    }

    /** Membres ACTIFS déjà adhérents, avec leur couverture de cotisations. */
    public List<MembreCouverture> actifsAvecCouverture() {
        Map<Long, Set<String>> parMembre = new HashMap<>();
        for (Cotisation c : cotisationRepo.findByStatutIn(List.of(Enums.CotiStatut.PAYE, Enums.CotiStatut.EN_ATTENTE))) {
            ajouterCouverture(c, parMembre.computeIfAbsent(c.getMembreId(), k -> new HashSet<>()));
        }
        List<MembreCouverture> out = new ArrayList<>();
        for (Membre m : membreRepo.findByEtatCompte(Enums.EtatCompte.ACTIF)) {
            LocalDate debut = debutCotisation(m);
            if (debut == null) continue;
            out.add(new MembreCouverture(m, debut, parMembre.getOrDefault(m.getId(), Set.of())));
        }
        return out;
    }

    /** Un membre en retard de cotisation (écran de suivi et de relances). */
    public record Arriere(Long membreId, String nom, String telephone, String email,
                          int nombreMois, List<String> moisImpayes, BigDecimal montantDu,
                          boolean avertissementPossible) {}

    /** Membres actifs ayant au moins un mois de cotisation impayé, du plus en retard au moins en retard. */
    public List<Arriere> arrieres() {
        BigDecimal cotisation = settingsService.montantCotisation();
        List<Arriere> out = new ArrayList<>();
        for (MembreCouverture mc : actifsAvecCouverture()) {
            List<String> impayes = mc.moisImpayes();
            if (impayes.isEmpty()) continue;
            Membre m = mc.membre();
            String nom = ((m.getFirstName() == null ? "" : m.getFirstName()) + " "
                    + (m.getLastName() == null ? "" : m.getLastName())).trim();
            out.add(new Arriere(m.getId(), nom.isBlank() ? m.getUsername() : nom, m.getPhone(), m.getEmail(),
                    impayes.size(), impayes, cotisation.multiply(BigDecimal.valueOf(impayes.size())),
                    impayes.size() >= MOIS_AVERTISSEMENT));
        }
        out.sort(Comparator.comparingInt(Arriere::nombreMois).reversed().thenComparing(Arriere::nom));
        return out;
    }
}
