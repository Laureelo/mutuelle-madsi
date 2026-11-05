// src/main/java/com/madsi/backend/manifestations/ManifestationController.java
package com.madsi.backend.manifestations;

import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.manifestations.dto.ManifestationDTO;
import com.madsi.backend.manifestations.dto.ManifestationIn;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/manifestations")
@RequiredArgsConstructor
public class ManifestationController {

    private final ManifestationService service;
    private final com.madsi.backend.security.AccessGuard guard;

    @GetMapping("/{id}")
    public ManifestationDTO get(@PathVariable Long id){
        return service.get(id);
    }

    @GetMapping
    public PageResponse<ManifestationDTO> search(
            @RequestParam(defaultValue="") String q,
            @RequestParam(required = false) String statut,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="10") int size
    ){
        return service.search(q, statut, from, to, page, size);
    }

    @PostMapping
    public ManifestationDTO create(@RequestBody ManifestationIn in){
        // Un membre déclare une manifestation à son nom ; trésorier / admin peuvent la saisir pour un membre
        guard.ensureSelfOr(in.membreId(), "TRESORIER", "ADMIN");
        return service.create(in);
    }

    @PutMapping("/{id}")
    public ManifestationDTO update(@PathVariable Long id, @RequestBody ManifestationIn in){
        return service.update(id, in);
    }

    @PostMapping("/{id}/valider")
    public ManifestationDTO valider(@PathVariable Long id){
        return service.validate(id, guard.currentMembreId());
    }

    @PostMapping("/{id}/rejeter")
    public ManifestationDTO rejeter(@PathVariable Long id, @RequestBody(required = false) MotifInput body){
        String motif = body==null? "-" : (body.motif==null? "-" : body.motif.trim());
        return service.reject(id, motif);
    }

    /**
     * POST /api/manifestations/{id}/annuler?membreId=XX : annulation par le membre déclarant
     */
    @PostMapping("/{id}/annuler")
    public ManifestationDTO annuler(@PathVariable Long id, @RequestParam(required = false) Long membreId){
        // Le déclarant est identifié par le jeton (le paramètre membreId éventuel est ignoré)
        return service.annulerParMembre(id, guard.currentMembreId());
    }

    /**
     * POST /api/manifestations/{id}/cloturer : clôture de la manifestation par le trésorier
     * Body: { tresorierId, montantPrevu, montantReel, materiaux, remarques }
     */
    @PostMapping("/{id}/cloturer")
    public ManifestationDTO cloturer(@PathVariable Long id, @RequestBody ClotureInput body){
        return service.cloturer(id, guard.currentMembreId(), body.montantPrevu,
                               body.montantReel, body.materiaux, body.remarques);
    }

    @Data
    public static class MotifInput { public String motif; }
    
    @Data
    public static class ClotureInput {
        public Long tresorierId;
        public java.math.BigDecimal montantPrevu;
        public java.math.BigDecimal montantReel;
        public String materiaux;
        public String remarques;
    }
}