package com.madsi.backend.operations;

import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.security.AccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Sert les reçus PDF (adhésions, cotisations, prêts, remboursements).
 * Accès : le membre concerné, ou un lecteur des finances (trésorier, commissaire, admin).
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ReceiptDownloadController {

    private final RecuRepository recuRepo;
    private final OperationRepository opRepo;
    private final ReceiptService receipts;
    private final AccessGuard guard;

    /** GET /api/recus/{recuId}/pdf : télécharger par id de reçu */
    @GetMapping("/recus/{recuId}/pdf")
    public ResponseEntity<FileSystemResource> downloadRecuById(@PathVariable Long recuId) {
        var recu = recuRepo.findById(recuId)
                .orElseThrow(() -> new NotFoundException("Reçu introuvable"));
        guard.ensureSelfOrFinance(receipts.membreIdOf(recu));
        return pdf(recu);
    }

    /**
     * GET /api/operations/{operationId}/recu/pdf : PDF du reçu d'une opération.
     * Si l'opération (validée avant la mise en place des reçus) n'a pas encore de reçu, il est créé.
     */
    @GetMapping("/operations/{operationId}/recu/pdf")
    public ResponseEntity<FileSystemResource> downloadRecuByOperation(@PathVariable Long operationId) {
        var op = opRepo.findById(operationId)
                .orElseThrow(() -> new NotFoundException("Opération introuvable"));
        guard.ensureSelfOrFinance(op.getMembreId());
        return pdf(receipts.pourOperation(operationId));
    }

    private ResponseEntity<FileSystemResource> pdf(Recu recu) {
        var file = receipts.fichierPdf(recu).toFile();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                .body(new FileSystemResource(file));
    }
}
