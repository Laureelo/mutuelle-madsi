package com.madsi.backend.operations;

import com.madsi.backend.common.Enums;
import com.madsi.backend.prets.PretRepository;
import com.madsi.backend.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Ce qui attend la confirmation du président (administrateur) : prêts et dépenses au-dessus du seuil.
 * Alimente l'alerte du tableau de bord (le président doit être informé avant que le trésorier valide).
 */
@RestController
@RequestMapping("/api/confirmations")
@RequiredArgsConstructor
public class ConfirmationController {

    private final PretRepository prets;
    private final OperationRepository operations;
    private final SettingsService settings;

    /** GET /api/confirmations/en-attente (administrateur) */
    @GetMapping("/en-attente")
    public Map<String, Object> enAttente() {
        var seuil = settings.seuilConfirmation();
        long nbPrets = prets.findByStatut(Enums.PretStatut.DEMANDE).stream()
                .filter(p -> p.getConfirmePar() == null && p.getMontantAccorde().compareTo(seuil) > 0)
                .count();
        long nbDepenses = operations.countByStatut(Enums.OpStatut.EN_ATTENTE_CONFIRMATION);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("prets", nbPrets);
        out.put("depenses", nbDepenses);
        out.put("total", nbPrets + nbDepenses);
        out.put("seuil", seuil);
        return out;
    }
}
