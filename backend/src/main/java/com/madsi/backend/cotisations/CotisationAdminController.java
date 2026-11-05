package com.madsi.backend.cotisations;

import com.madsi.backend.cotisations.dto.CotisationDTO;
import com.madsi.backend.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Endpoints côté Trésorerie : liste filtrée + annulation
 */
@RestController
@RequestMapping("/api/cotisations")
@RequiredArgsConstructor
public class CotisationAdminController {

    private final CotisationService service;

    // Liste paginée avec filtres texte/mois/mode/statut
    @GetMapping("/admin")
    public PageResponse<CotisationDTO> listAdmin(@RequestParam(defaultValue = "") String q,
                                                 @RequestParam(defaultValue = "") String mois,
                                                 @RequestParam(defaultValue = "") String mode,
                                                 @RequestParam(defaultValue = "") String statut,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "10") int size){
        return service.searchAdmin(q, mois, mode, statut, page, size);
    }

    // Annuler une cotisation (trace : Operation => ANNULEE)
    @PostMapping("/{id}/annuler")
    public CotisationDTO annuler(@PathVariable Long id, @RequestBody Map<String,String> body){
        var motif = body.getOrDefault("motif", "Annulation trésorerie");
        return service.annuler(id, motif);
    }
}
