package com.madsi.backend.preuves;

import com.madsi.backend.adhesion.AdhesionRepository;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.cotisations.CotisationRepository;
import com.madsi.backend.operations.OperationRepository;
import com.madsi.backend.prets.PretRepository;
import com.madsi.backend.security.AccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Preuves de paiement (images jointes aux cotisations, adhésions, prêts, opérations).
 *
 * Les listes n'envoient PAS les images (elles pèseraient plusieurs Mo) : elles indiquent seulement
 * « aPreuve ». L'image se charge ici, à la demande, quand on ouvre la preuve.
 * Accès : le membre concerné, ou un lecteur des finances (trésorier, commissaire, admin).
 */
@RestController
@RequestMapping("/api/preuves")
@RequiredArgsConstructor
public class PreuveController {

    private final CotisationRepository cotisations;
    private final AdhesionRepository adhesions;
    private final PretRepository prets;
    private final OperationRepository operations;
    private final AccessGuard guard;

    private record Preuve(Long membreId, String data) {}

    /** GET /api/preuves/{cotisations|adhesions|prets|operations}/{id} -> { "data": "data:image/jpeg;base64,..." } */
    @GetMapping("/{type}/{id}")
    public Map<String, Object> get(@PathVariable String type, @PathVariable Long id) {
        Preuve p = switch (type) {
            case "cotisations" -> cotisations.findById(id)
                    .map(c -> new Preuve(c.getMembreId(), c.getPhotoPreuve()))
                    .orElseThrow(() -> new NotFoundException("Cotisation introuvable"));
            case "adhesions" -> adhesions.findById(id)
                    .map(a -> new Preuve(a.getMembreId(), a.getPhotoPreuve()))
                    .orElseThrow(() -> new NotFoundException("Adhésion introuvable"));
            case "prets" -> prets.findById(id)
                    .map(x -> new Preuve(x.getMembreId(), x.getPhotoPreuve()))
                    .orElseThrow(() -> new NotFoundException("Prêt introuvable"));
            case "operations" -> operations.findById(id)
                    .map(o -> new Preuve(o.getMembreId(), o.getPhotoPreuve()))
                    .orElseThrow(() -> new NotFoundException("Opération introuvable"));
            default -> throw new NotFoundException("Type de preuve inconnu");
        };
        guard.ensureSelfOrFinance(p.membreId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", p.data());
        return out;
    }
}
