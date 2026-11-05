package com.madsi.backend.prets;

import com.madsi.backend.common.Enums.ModePaiement;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/remboursements")
@RequiredArgsConstructor
public class RemboursementController {

    private final RemboursementService service;
    private final EcheanceRepository echRepo;
    private final PretRepository pretRepo;
    private final com.madsi.backend.security.AccessGuard guard;

    /** A) Encaissement espèces au guichet (trésorière) => enregistre immédiatement l'opération + reçu + notif */
    @PostMapping
    public RemboursementAck rembourser(@RequestBody @jakarta.validation.Valid RemboursementInput in){
        return service.enregistrer(in.echeanceId, in.montant, in.modePaiement, in.reference);
    }

    /** B1) Soumission mobile money par le membre => EN_ATTENTE (pas d'opération) */
    @PostMapping("/mobile/submit")
    public RemboursementPret submitMobile(@RequestBody @jakarta.validation.Valid MobileSubmitInput in){
        // Un membre ne peut soumettre une preuve que pour SES propres échéances
        var ech = echRepo.findById(in.echeanceId)
                .orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Échéance introuvable"));
        var pret = pretRepo.findById(ech.getPretId())
                .orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Prêt introuvable"));
        if (!guard.isSelf(pret.getMembreId())) {
            throw new org.springframework.security.access.AccessDeniedException("Cette échéance ne vous appartient pas");
        }
        return service.submitMobileProof(in.echeanceId, in.montant, in.reference, in.preuveUrl);
    }

    /** B2) Validation par la trésorière => crée opération + reçu + notif */
    @PostMapping("/{id}/valider")
    public RemboursementAck valider(@PathVariable Long id){
        return service.validerMobile(id, guard.currentMembreId());
    }

    /** B3) Rejet par la trésorière => notif de rejet (pas d'opération) */
    @PostMapping("/{id}/rejeter")
    public RemboursementPret rejeter(@PathVariable Long id, @RequestBody(required = false) MotifInput in){
        return service.rejeterMobile(id, in!=null? in.motif : null);
    }

    /** C) Récupérer tous les remboursements en attente (trésorier) */
    @GetMapping("/pending")
    public List<RemboursementPret> getPending(){
        return service.getPending();
    }

    // ---- DTOs ----
    @Data
    public static class RemboursementInput {
        @NotNull Long echeanceId;
        @NotNull @Positive BigDecimal montant;
        @NotNull ModePaiement modePaiement; // ESPECES ou MOBILE_MONEY, mais ici utilisé pour espèces
        String reference;
    }

    @Data
    public static class MobileSubmitInput {
        @NotNull Long echeanceId;
        @NotNull @Positive BigDecimal montant;
        @NotNull String reference;    // TxnID
        String preuveUrl;             // optionnel
    }

    @Data
    public static class MotifInput { String motif; }
}