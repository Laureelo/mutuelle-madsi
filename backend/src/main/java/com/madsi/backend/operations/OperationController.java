// src/main/java/com/madsi/backend/operations/OperationController.java
package com.madsi.backend.operations;

import java.math.BigDecimal;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.madsi.backend.common.Enums.*;
import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.Enums.ObjetRecu;
import com.madsi.backend.common.Enums.OpStatut;
import com.madsi.backend.common.Enums.SensOp;
import com.madsi.backend.common.Enums.TypeOperation;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.operations.dto.OperationAck;
import com.madsi.backend.operations.dto.OperationDTO;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OperationController {

    private final OperationRepository repo;
    private final OperationService service;
    private final ReceiptService receipts;
    private final OperationMapper mapper;
    private final com.madsi.backend.security.AccessGuard guard;

    // ----- JOURNAL (avec filtres) -----
    @GetMapping("/operations")
    public PageResponse<OperationDTO> list(
            @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="10") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) SensOp sens,
            @RequestParam(required = false, name="typeOp") TypeOperation typeOp,
            @RequestParam(required = false) ModePaiement mode,
            @RequestParam(required = false) OpStatut statut,
            @RequestParam(required = false) String dateFrom, // YYYY-MM-DD
            @RequestParam(required = false) String dateTo    // YYYY-MM-DD
    ){
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "dateOp"));
        var pageOps = service.search(q, sens, typeOp, mode, statut, dateFrom, dateTo, pageable)
                .map(mapper::toDTO);
        return PageResponse.of(pageOps);
    }

    // ----- SAISIE APPORT -----
    @PostMapping("/caisse/apports")
    public OperationAck createApport(@RequestBody @Valid SaisieInput in){
        var op = service.credit(TypeOperation.APPORT, in.montant, in.modePaiement, in.reference, in.membreId,
                "apport", null);
        var recu = receipts.generate(op, ObjetRecu.APPORT, in.montant, in.modePaiement, in.reference);
        return new OperationAck(op.getId(), recu.getId(), recu.getNumero(), recu.getFichierPdfUrl());
    }

    // ----- SAISIE RECETTE -----
    @PostMapping("/caisse/recettes")
    public OperationAck createRecette(@RequestBody @Valid SaisieInput in){
        var op = service.credit(TypeOperation.RECETTE, in.montant, in.modePaiement, in.reference, in.membreId,
                "recette", null);
        var recu = receipts.generate(op, ObjetRecu.RECETTE, in.montant, in.modePaiement, in.reference);
        return new OperationAck(op.getId(), recu.getId(), recu.getNumero(), recu.getFichierPdfUrl());
    }

    // ----- SAISIE DEPENSE (caisse) -----
    @PostMapping("/caisse/depenses")
    public OperationAck createDepense(@RequestBody @Valid SaisieInput in){
        var op = service.depense(in.montant, in.modePaiement, in.reference, in.membreId, "depense", null);
        return ackDepense(op, in.montant, in.modePaiement, in.reference);
    }

    // ----- DEPENSE générique (manifestation, ...) -----
    @PostMapping("/operations/depenses")
    public OperationAck createDepenseObjet(@RequestBody @Valid DepenseInput in){
        var op = service.depense(in.montant, in.modePaiement, in.reference, in.membreId, in.objetType, in.objetId);
        return ackDepense(op, in.montant, in.modePaiement, in.reference);
    }

    /** Accusé d'une dépense : reçu immédiat, ou « en attente de confirmation du président » au-dessus du seuil. */
    private OperationAck ackDepense(Operation op, java.math.BigDecimal montant, ModePaiement mode, String reference) {
        if (op.getStatut() == com.madsi.backend.common.Enums.OpStatut.EN_ATTENTE_CONFIRMATION) {
            return new OperationAck(op.getId(), null, null, null, true);
        }
        var recu = receipts.generate(op, ObjetRecu.DEPENSE, montant, mode, reference);
        return new OperationAck(op.getId(), recu.getId(), recu.getNumero(), recu.getFichierPdfUrl());
    }

    // ----- CONFIRMATION / REFUS par le président (administrateur) d'une dépense au-dessus du seuil -----
    @PostMapping("/operations/{id}/confirmer")
    public OperationAck confirmer(@PathVariable Long id){
        var op = service.confirmerDepense(id, guard.currentMembreId());
        var recu = receipts.generate(op, ObjetRecu.DEPENSE, op.getMontant(), op.getModePaiement(), op.getReference());
        return new OperationAck(op.getId(), recu.getId(), recu.getNumero(), recu.getFichierPdfUrl());
    }

    @PostMapping("/operations/{id}/refuser")
    public OperationDTO refuser(@PathVariable Long id, @RequestBody(required = false) MotifInput body){
        var op = service.refuserDepense(id, guard.currentMembreId(), body == null ? null : body.motif());
        return mapper.toDTO(op);
    }

    // ----- ANNULATION (compatible query param ET body) -----
    @PostMapping("/operations/{id}/annuler")
    public OperationDTO annuler(
            @PathVariable Long id,
            @RequestParam(name = "motif", required = false) String motifQuery,
            @RequestBody(required = false) MotifInput body){
        var motif = motifQuery != null ? motifQuery : (body == null ? null : body.motif());
        var op = service.annuler(id, motif);
        return mapper.toDTO(op);
    }

    // ----- SOLDE ACTUEL -----
    @GetMapping("/operations/solde")
    public java.util.Map<String, Object> solde(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
            java.time.LocalDate date){
        var today = (date != null ? date : java.time.LocalDate.now());
        if (today.isAfter(java.time.LocalDate.now())) {
            throw new IllegalArgumentException("Choisissez aujourd'hui ou une date passée : le solde d'une date à venir n'est pas connu.");
        }
        var tomorrow = today.plusDays(1); // Pour inclure ce jour-là (exclusif)
        var start = java.time.LocalDate.of(1900, 1, 1); // Depuis le début
        var solde = repo.soldeBetween(start, tomorrow);
        var entrees = repo.sumBySensBetween(SensOp.ENTREE, start, tomorrow);
        var sorties = repo.sumBySensBetween(SensOp.SORTIE, start, tomorrow);
        
        return java.util.Map.of(
            "soldeTotal", solde,
            "totalEntrees", entrees,
            "totalSorties", sorties,
            "date", today.toString(),
            "derniereMiseAJour", java.time.LocalDateTime.now().toString()
        );
    }

    // -------- DTOs d'entrée --------
    @Data
    public static class SaisieInput {
        @NotNull @Positive
        BigDecimal montant;

        @NotNull
        ModePaiement modePaiement;

        @Size(max=100)
        String reference;

        Long membreId;
    }

    @Data
    public static class DepenseInput {
        @NotNull @Positive
        BigDecimal montant;

        @NotNull
        ModePaiement modePaiement;

        @Size(max=100)
        String reference;

        Long membreId;

        @NotNull
        String objetType;  // "manifestation", "pret", ...

        @NotNull
        Long objetId;

        String description; // optionnel
    }

    public record MotifInput(String motif){}
}