package com.madsi.backend.cotisations;

import com.madsi.backend.membres.EligibiliteService;
import com.madsi.backend.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Suivi des cotisations impayées (trésorier, administrateur) : qui doit combien de mois et de FCFA.
 * Sert à l'écran « Relances » (boutons WhatsApp et email).
 */
@RestController
@RequestMapping("/api/cotisations/arrieres")
@RequiredArgsConstructor
public class ArrieresController {

    private final EligibiliteService eligibilite;
    private final SettingsService settings;

    @GetMapping
    public Map<String, Object> arrieres() {
        List<EligibiliteService.Arriere> liste = eligibilite.arrieres();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("membres", liste);
        out.put("montantCotisation", settings.montantCotisation());
        out.put("totalMembres", liste.size());
        out.put("totalMontant", liste.stream().map(EligibiliteService.Arriere::montantDu)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));
        out.put("moisAvertissement", EligibiliteService.MOIS_AVERTISSEMENT);
        return out;
    }
}
