package com.madsi.backend.operations;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.prets.RemboursementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ReceiptQueryController {

    private final RecuRepository recuRepo;
    private final OperationRepository opRepo;
    private final RemboursementRepository rembRepo;
    private final com.madsi.backend.security.AccessGuard guard;
    private final ReceiptService receipts;

    /** Reçu (JSON) par id d’opération : le membre concerné, ou un lecteur des finances. Créé s'il manque. */
    @GetMapping("/operations/{operationId}/recu")
    public RecuDTO recuByOperation(@PathVariable Long operationId){
        var op = opRepo.findById(operationId)
                .orElseThrow(() -> new NotFoundException("Opération introuvable"));
        guard.ensureSelfOrFinance(op.getMembreId());
        return RecuDTO.from(receipts.pourOperation(operationId));
    }

    /** Reçu (JSON) du décaissement d’un prêt */
    @GetMapping("/prets/{pretId}/recu-versement")
    public RecuDTO recuVersementPret(@PathVariable Long pretId){
        var op = opRepo.findTopByObjetTypeAndObjetIdAndTypeOpOrderByIdDesc("pret", pretId, Enums.TypeOperation.DEPENSE)
                .orElseThrow(() -> new NotFoundException("Opération de décaissement introuvable pour le prêt " + pretId));
        return recuByOperation(op.getId());
    }

    /** Reçu (JSON) d’un remboursement */
    @GetMapping("/remboursements/{rembId}/recu")
    public RecuDTO recuRemboursement(@PathVariable Long rembId){
        var remb = rembRepo.findById(rembId)
                .orElseThrow(() -> new NotFoundException("Remboursement introuvable"));
        if (remb.getOperationId() == null){
            throw new NotFoundException("Aucune opération liée à ce remboursement");
        }
        return recuByOperation(remb.getOperationId());
    }
}
