package com.madsi.backend.prets;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.prets.dto.PretDTO;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/prets")
@RequiredArgsConstructor
public class PretController {

    private final PretService service;
    private final PretRepository pretRepo;
    private final com.madsi.backend.security.AccessGuard guard;

    // 1) Demander un prêt (le membre pour lui-même ; le trésorier peut saisir pour un membre au guichet)
    @PostMapping
    public PretDTO demander(@RequestBody @jakarta.validation.Valid DemandePretInput in){
        guard.ensureSelfOrTresorier(in.membreId);
        Pret pret = service.demander(in.membreId, in.montant, in.dureeMois, in.periodeUnite, in.motif);
        return service.toDTO(pret);
    }

    // 2) Valider (trésorier/admin métier)
    @PostMapping("/{id}/valider")
    public PretDTO valider(@PathVariable Long id){
        return service.toDTO(service.valider(id, guard.currentMembreId()));
    }

    // 2-bis) Confirmation par le président (administrateur) d'un prêt au-dessus du seuil
    @PostMapping("/{id}/confirmer")
    public PretDTO confirmer(@PathVariable Long id){
        return service.toDTO(service.confirmer(id, guard.currentMembreId()));
    }

    // 2-ter) Refus par le président (administrateur) d'un prêt au-dessus du seuil
    @PostMapping("/{id}/refuser-president")
    public PretDTO refuserParPresident(@PathVariable Long id, @RequestBody(required = false) MotifInput input){
        String motif = (input != null) ? input.getMotif() : null;
        return service.toDTO(service.refuserParPresident(id, guard.currentMembreId(), motif));
    }

    // 2a) Approuver (alias pour valider)
    @PostMapping("/{id}/approuver")
    public PretDTO approuver(@PathVariable Long id){
        return service.toDTO(service.valider(id, guard.currentMembreId()));
    }

    // 2b) Refuser
    @PostMapping("/{id}/refuser")
    public PretDTO refuser(@PathVariable Long id, @RequestBody(required = false) MotifInput input){
        String motif = (input != null && input.getMotif() != null) ? input.getMotif() : null;
        return service.toDTO(service.refuser(id, motif));
    }

    // 2c) Rejeter (alias pour refuser, avec motif optionnel)
    @PostMapping("/{id}/rejeter")
    public PretDTO rejeter(@PathVariable Long id, @RequestBody(required = false) MotifInput input){
        String motif = (input != null && input.getMotif() != null) ? input.getMotif() : null;
        return service.toDTO(service.refuser(id, motif));
    }

    // 3) Verser (décaissement + reçu + échéancier) -> ACK avec PDF
    @PostMapping("/{id}/verser")
    public VerserAck verser(@PathVariable Long id, @RequestBody @jakarta.validation.Valid VerserInput in){
        return service.verser(id, guard.currentMembreId(), in.modePaiement, in.reference, in.getDateDecaissementAsDate(), in.photoPreuve);
    }

    // 4) Lire : tous les prêts avec pagination (admin) - triés par ID décroissant (plus récent en premier)
    @GetMapping
    public PageResponse<PretDTO> listAll(@RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "10") int size,
                                         @RequestParam(required = false) String statut){
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200),
                org.springframework.data.domain.Sort.by("id").descending());
        var pageData = statut != null && !statut.isEmpty()
                ? pretRepo.findByStatut(com.madsi.backend.common.Enums.PretStatut.valueOf(statut), pageable)
                : pretRepo.findAll(pageable);

        List<PretDTO> dtos = pageData.getContent().stream()
                .map(service::toDTO)
                .collect(Collectors.toList());

        return new PageResponse<>(
            dtos,
            pageData.getNumber(),
            pageData.getSize(),
            pageData.getTotalElements(),
            pageData.getTotalPages()
        );
    }

    // 5) Lire : par membre / détail / échéancier
    @GetMapping("/membre/{membreId}")
    public List<PretDTO> listByMembre(@PathVariable Long membreId){
        guard.ensureSelfOrFinance(membreId);
        return service.toDTOList(service.listByMembre(membreId));
    }

    @GetMapping("/{id}")
    public PretDTO get(@PathVariable Long id){
        var pret = service.get(id);
        guard.ensureSelfOrFinance(pret.getMembreId());
        return service.toDTO(pret);
    }

    @GetMapping("/{id}/echeancier")
    public List<Echeance> schedule(@PathVariable Long id){
        guard.ensureSelfOrFinance(service.get(id).getMembreId());
        return service.schedule(id);
    }

    // ---------- DTOs d'entrée (validés) ----------
    @Data
    public static class DemandePretInput {
        @NotNull Long membreId;
        @NotNull @Positive BigDecimal montant;
        @NotNull @Positive Integer dureeMois;
        String periodeUnite; // JOUR, SEMAINE, MOIS (défaut: MOIS)
        String motif;        // Motif de la demande (facultatif)
    }

    @Data
    public static class VerserInput {
        @NotNull ModePaiement modePaiement;
        String reference;
        @NotNull String dateDecaissement; // Accepte string du frontend (format YYYY-MM-DD)
        String photoPreuve; // Base64 ou URL de la preuve de paiement

        public LocalDate getDateDecaissementAsDate() {
            return dateDecaissement != null ? LocalDate.parse(dateDecaissement) : null;
        }
    }

    @Data
    public static class MotifInput {
        String motif;
    }
}