package com.madsi.backend.config;

import com.madsi.backend.common.Enums;
import com.madsi.backend.manifestations.TypeActivite;
import com.madsi.backend.manifestations.TypeActiviteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Initialise les types d'activités par défaut si la table est vide.
 *
 * Les montants des prestations sociales sont ceux du Règlement Intérieur de la MADSI
 * (article 11). Ils peuvent ensuite être modifiés par l'administrateur depuis
 * l'écran « Types d'activité » (l'Assemblée Générale fixe les montants, statuts art. 6).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TypeActiviteInitializer implements CommandLineRunner {

    private final TypeActiviteRepository typeActiviteRepository;

    private static TypeActivite type(String libelle, Enums.TypeActiviteCat cat, String sousType, int montant, String lieu) {
        return TypeActivite.builder()
                .libelle(libelle)
                .type(cat)
                .sousType(sousType)
                .montantAlloue(montant)
                .lieu(lieu)
                .build();
    }

    @Override
    public void run(String... args) {
        if (typeActiviteRepository.count() > 0) {
            log.info("Types d'activités déjà initialisés ({} types trouvés).", typeActiviteRepository.count());
            return;
        }

        log.info("Aucun type d'activité trouvé. Création des types d'activités du règlement intérieur...");

        List<TypeActivite> types = List.of(
                // --- Prestations sociales (Règlement intérieur, article 11) ---
                type("Mariage", Enums.TypeActiviteCat.MARIAGE, "", 20_000, "Variable"),
                type("Naissance", Enums.TypeActiviteCat.NAISSANCE, "", 10_000, "Variable"),
                type("Maladie (visite)", Enums.TypeActiviteCat.MALADIE, "2 visites au plus, espacées de 2 semaines", 5_000, "Variable"),
                type("Décès d'un membre", Enums.TypeActiviteCat.DECES, "", 100_000, "Variable"),
                type("Décès d'un proche", Enums.TypeActiviteCat.DECES, "Conjoint(e), père, mère, enfant", 50_000, "Variable"),
                type("Décès (fratrie, beaux-parents)", Enums.TypeActiviteCat.DECES, "", 5_000, "Variable"),
                type("Départ à la retraite", Enums.TypeActiviteCat.RETRAITE, "", 75_000, "Variable"),

                // --- Activités (montants indicatifs, modifiables) ---
                type("Activité sportive", Enums.TypeActiviteCat.SPORT, "", 1_000, "Variable"),
                type("Activité socioculturelle", Enums.TypeActiviteCat.CULTURE, "", 10_000, "Variable")
        );

        typeActiviteRepository.saveAll(types);

        log.info("{} types d'activités créés.", types.size());
        types.forEach(t -> log.info("   - {} / {} : {} FCFA", t.getType(), t.getSousType(), t.getMontantAlloue()));
    }
}
