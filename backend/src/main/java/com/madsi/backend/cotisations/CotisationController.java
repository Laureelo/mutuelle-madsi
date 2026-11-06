package com.madsi.backend.cotisations;


import java.math.BigDecimal;
import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.cotisations.dto.CotisationDTO;
import com.madsi.backend.cotisations.dto.CotisationResponseDTO;
import com.madsi.backend.cotisations.dto.ExistsResponse;
import com.madsi.backend.operations.RecuRepository;

import lombok.Data;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/cotisations")
@RequiredArgsConstructor
public class CotisationController {

    private final CotisationService service;
    private final CotisationMembreService cotisationMembreService;
    private final CotisationRepository repo;
    private final RecuRepository recuRepo;
    private final com.madsi.backend.operations.ReceiptService receipts;
    private final com.madsi.backend.security.AccessGuard guard;

    // Lister les cotisations d'un membre (lui-même, ou trésorier / commissaire / admin)
    @GetMapping
    public List<Cotisation> parMembre(@RequestParam Long membreId){
        guard.ensureSelfOrFinance(membreId);
        return service.parMembre(membreId);
    }

    // Récupérer une cotisation par ID (son propriétaire, ou trésorier / commissaire / admin)
    @GetMapping("/{id}")
    public CotisationDTO getById(@PathVariable Long id){
        var dto = service.getById(id);
        guard.ensureSelfOrFinance(dto.membreId());
        return dto;
    }

    // Créer une cotisation (journal + reçu automatiques)
    @PostMapping
    public Cotisation creer(@RequestBody CotisationCreateInput input){
        var c = Cotisation.builder()
                .membreId(input.membreId)
                .periodes(input.periode)  // Changé de periode à periodes
                .nombreMois(1)            // Par défaut 1 mois
                .montant(input.montant)
                .datePaiement(input.datePaiement)
                .statut(input.statut != null ? input.statut : com.madsi.backend.common.Enums.CotiStatut.PAYE)
                .build();

        // Le service se charge d'affecter modePaiement + reference et de tout journaliser
        return service.creer(c, input.modePaiement, input.reference);
    }

    // Mettre à jour une cotisation
    @PutMapping("/{id}")
    public CotisationDTO update(@PathVariable Long id, @RequestBody CotisationUpdateInput input){
        return service.update(id, input.montant, input.periode, input.datePaiement, 
                             input.modePaiement, input.reference, input.statut);
    }

    // Supprimer une cotisation
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id){
        service.delete(id);
    }

    // Valider une cotisation
    @PostMapping("/{id}/valider")
    public CotisationDTO valider(@PathVariable Long id){
        var cot = repo.findById(id)
                .orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Cotisation introuvable"));
        if (guard.isSelf(cot.getMembreId())) {
            throw new IllegalStateException("Vous ne pouvez pas valider votre propre cotisation : un autre trésorier doit le faire.");
        }
        return service.valider(id);
    }

    // Récupérer les cotisations d'un membre
    @GetMapping("/membre/{membreId}")
    public List<Cotisation> getByMembre(@PathVariable Long membreId){
        guard.ensureSelfOrFinance(membreId);
        return service.parMembre(membreId);
    }

    // Vérifier si une cotisation existe pour un membre et une période
    @GetMapping("/exists/membre/{membreId}/periode/{periode}")
    public ExistsResponse checkExists(@PathVariable Long membreId, @PathVariable String periode){
        guard.ensureSelfOrFinance(membreId);
        return service.checkExists(membreId, periode);
    }

    // Récupérer le total des cotisations pour une période
    @GetMapping("/total/periode/{periode}")
    public TotalResponse getTotalByPeriode(@PathVariable String periode){
        BigDecimal total = service.getTotalByPeriode(periode);
        return new TotalResponse(total);
    }

    // Récupérer le reçu associé à la cotisation (dernière version)
    @GetMapping("/{id}/recu")
    public com.madsi.backend.operations.RecuDTO recu(@PathVariable Long id){
        var cot = repo.findById(id)
                .orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Cotisation introuvable"));
        guard.ensureSelfOrFinance(cot.getMembreId());
        if (cot.getOperationId() == null) {
            throw new com.madsi.backend.common.exception.NotFoundException(
                    "Aucun reçu : la cotisation n'a pas encore été validée par le trésorier.");
        }
        return com.madsi.backend.operations.RecuDTO.from(receipts.pourOperation(cot.getOperationId()));
    }

    // ===== NOUVEAUX ENDPOINTS POUR DÉCLARATION PAR LES MEMBRES =====

    /**
     * Déclarer une cotisation par un membre
     * Le membre déclare avoir payé pour N mois
     */
    @PostMapping("/declarer")
    public Cotisation declarer(@RequestBody DeclarerCotisationInput input) {
        // Un membre déclare pour lui-même ; seul le trésorier peut saisir pour un autre membre (guichet)
        if (input.membreId == null) {
            input.membreId = guard.currentMembreId();
        }
        guard.ensureSelfOrTresorier(input.membreId);
        return cotisationMembreService.declarer(
            input.membreId,
            input.moisDebut,
            input.nombreMois,
            input.modePaiement,
            input.reference,
            input.remarque,
            input.photoPreuve
        );
    }

    /**
     * Valider une cotisation (trésorier)
     */
    @PostMapping("/{id}/valider-cotisation")
    public Cotisation validerCotisation(@PathVariable Long id, @RequestBody(required = false) ValiderCotisationInput input) {
        // Le trésorier est identifié par le jeton (tresorierId éventuellement envoyé est ignoré)
        return cotisationMembreService.valider(id, guard.currentMembreId());
    }

    /**
     * Rejeter une cotisation (trésorier)
     */
    @PostMapping("/{id}/rejeter")
    public CotisationResponseDTO rejeterCotisation(@PathVariable Long id, @RequestBody RejeterCotisationInput input) {
        Cotisation cotisation = cotisationMembreService.rejeter(id, guard.currentMembreId(), input.motif);
        // Convertir en DTO pour retourner la cotisation rejetée
        return cotisationMembreService.toDTO(cotisation);
    }

    /**
     * Récupérer mes cotisations (membre connecté) - avec nom du membre
     */
    @GetMapping("/mes-cotisations")
    public List<CotisationResponseDTO> getMesCotisations(@RequestParam(required = false) Long membreId) {
        Long cible = membreId != null ? membreId : guard.currentMembreId();
        guard.ensureSelfOrFinance(cible);
        return cotisationMembreService.getMesCotisationsDTO(cible);
    }

    /**
     * Récupérer les cotisations en attente de validation (trésorier) - avec nom du membre
     */
    @GetMapping("/en-attente")
    public List<CotisationResponseDTO> getCotisationsEnAttente() {
        return cotisationMembreService.getCotisationsEnAttenteDTO();
    }

    /**
     * Récupérer toutes les cotisations (tous membres, tous statuts) - avec nom du membre
     */
    @GetMapping("/toutes")
    public List<CotisationResponseDTO> getToutesCotisations() {
        return cotisationMembreService.getToutesCotisationsDTO();
    }

    /**
     * Vérifier les mois non payés pour un membre
     */
    @GetMapping("/mois-non-payes")
    public List<String> getMoisNonPayes(@RequestParam Long membreId, @RequestParam int annee) {
        guard.ensureSelfOrFinance(membreId);
        return cotisationMembreService.getMoisNonPayes(membreId, annee);
    }

    @Data
    public static class CotisationCreateInput {
        public Long membreId;
        public String periode;           // "AAAA-MM"
        public java.math.BigDecimal montant;
        public java.time.LocalDate datePaiement;
        public com.madsi.backend.common.Enums.CotiStatut statut;
        public ModePaiement modePaiement;   // ESPECES / MOBILE_MONEY
        public String reference;            // ex: TxnID mobile money
    }

    @Data
    public static class CotisationUpdateInput {
        public java.math.BigDecimal montant;
        public String periode;
        public java.time.LocalDate datePaiement;
        public ModePaiement modePaiement;
        public String reference;
        public com.madsi.backend.common.Enums.CotiStatut statut;
    }

    @Data
    public static class AnnulerInput {
        public String motif;
    }

    @Data
    public static class TotalResponse {
        public BigDecimal total;
        public TotalResponse(BigDecimal total) {
            this.total = total;
        }
    }

    @Data
    public static class DeclarerCotisationInput {
        public Long membreId;
        public String moisDebut;         // Format: "2026-01"
        public Integer nombreMois;        // Nombre de mois à payer (1-12)
        public ModePaiement modePaiement; // ESPECES / MOBILE_MONEY
        public String reference;          // Numéro de transaction
        public String remarque;           // Remarque optionnelle
        public String photoPreuve;        // Chemin ou URL de la photo de preuve de paiement
    }

    @Data
    public static class ValiderCotisationInput {
        public Long tresorierId;
    }

    @Data
    public static class RejeterCotisationInput {
        public Long tresorierId;
        public String motif;
    }
}
