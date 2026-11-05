package com.madsi.backend.prets;

import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.security.AccessGuard;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * Consultation des échéances de prêt. Accès : le propriétaire du prêt,
 * ou un lecteur des finances (trésorier, commissaire, admin).
 */
@RestController
@RequestMapping("/api/echeances")
@RequiredArgsConstructor
public class EcheanceQueryController {

    private final EcheanceRepository echRepo;
    private final RemboursementRepository rembRepo;
    private final PretRepository pretRepo;
    private final AccessGuard guard;

    /** Charge l'échéance et vérifie que l'utilisateur a le droit de la voir. */
    private Echeance charger(Long id) {
        var e = echRepo.findById(id).orElseThrow(() -> new NotFoundException("Échéance introuvable"));
        var pret = pretRepo.findById(e.getPretId()).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        guard.ensureSelfOrFinance(pret.getMembreId());
        return e;
    }

    // GET /api/echeances/{id}
    @GetMapping("/{id}")
    public Echeance get(@PathVariable Long id){
        return charger(id);
    }

    // GET /api/echeances/{id}/remboursements
    @GetMapping("/{id}/remboursements")
    public List<RemboursementPret> remboursements(@PathVariable Long id){
        charger(id);
        return rembRepo.findByEcheanceIdOrderByDatePaiementAsc(id);
    }

    // GET /api/echeances/{id}/solde  -> { montantDu, cumulePaye, reste }
    @GetMapping("/{id}/solde")
    public EcheanceSolde solde(@PathVariable Long id){
        var e = charger(id);
        BigDecimal cumule = rembRepo.sumByEcheance(id);
        BigDecimal reste = e.getMontantDu().subtract(cumule);
        if (reste.signum() < 0) reste = BigDecimal.ZERO; // sécurité, pas de reste négatif
        return new EcheanceSolde(e.getMontantDu(), cumule, reste);
    }

    // petit DTO de réponse
    public record EcheanceSolde(
            @NotNull BigDecimal montantDu,
            @NotNull BigDecimal cumulePaye,
            @NotNull BigDecimal reste
    ) {}
}
