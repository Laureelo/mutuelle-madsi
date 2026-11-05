package com.madsi.backend.adhesions;

import com.madsi.backend.adhesions.dto.EnregistrerPaiementDTO;
import com.madsi.backend.adhesions.dto.PaiementAdhesionDTO;
import com.madsi.backend.adhesions.dto.ValiderPaiementDTO;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller pour la gestion des paiements d'adhésion
 * - Trésorier : enregistrer et valider les paiements
 * - Admin : consultation
 */
@RestController
@RequestMapping("/api/paiements-adhesion")
@RequiredArgsConstructor
public class PaiementAdhesionController {

    private final PaiementAdhesionService paiementAdhesionService;
    private final MembreRepository membreRepository;

    /**
     * Enregistrer un paiement d'adhésion (trésorier)
     */
    @PostMapping
    @PreAuthorize("hasRole('TRESORIER')")
    public ResponseEntity<?> enregistrerPaiement(
            @Valid @RequestBody EnregistrerPaiementDTO dto,
            Authentication authentication
    ) {
        try {
            Long tresorerId = getMembreIdFromAuth(authentication);

            PaiementAdhesion paiement = paiementAdhesionService.enregistrerPaiement(
                    dto.membreId(),
                    dto.modePaiement(),
                    dto.datePaiement(),
                    dto.reference(),
                    dto.photoPreuve(),
                    dto.remarques(),
                    tresorerId
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "success", true,
                    "message", "Paiement d'adhésion enregistré avec succès.",
                    "paiement", PaiementAdhesionDTO.fromEntity(paiement)
            ));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Récupérer tous les paiements en attente de validation (trésorier)
     */
    @GetMapping("/en-attente")
    @PreAuthorize("hasRole('TRESORIER')")
    public ResponseEntity<PageResponse<PaiementAdhesion>> getPaiementsEnAttente(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        PageResponse<PaiementAdhesion> paiements = paiementAdhesionService.getPaiementsEnAttente(page, size);
        return ResponseEntity.ok(paiements);
    }

    /**
     * Compter les paiements en attente (trésorier)
     */
    @GetMapping("/en-attente/count")
    @PreAuthorize("hasRole('TRESORIER')")
    public ResponseEntity<Map<String, Long>> countPaiementsEnAttente() {
        long count = paiementAdhesionService.countPaiementsEnAttente();
        return ResponseEntity.ok(Map.of("count", count));
    }

    /**
     * Valider un paiement d'adhésion (trésorier)
     */
    @PostMapping("/{id}/valider")
    @PreAuthorize("hasRole('TRESORIER')")
    public ResponseEntity<?> validerPaiement(
            @PathVariable Long id,
            Authentication authentication
    ) {
        try {
            Long adminId = getMembreIdFromAuth(authentication);
            PaiementAdhesion paiement = paiementAdhesionService.validerPaiement(id, adminId);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Paiement d'adhésion validé. Le membre est maintenant actif.",
                    "paiement", PaiementAdhesionDTO.fromEntity(paiement)
            ));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Rejeter un paiement d'adhésion (trésorier)
     */
    @PostMapping("/{id}/rejeter")
    @PreAuthorize("hasRole('TRESORIER')")
    public ResponseEntity<?> rejeterPaiement(
            @PathVariable Long id,
            @Valid @RequestBody ValiderPaiementDTO dto,
            Authentication authentication
    ) {
        try {
            Long adminId = getMembreIdFromAuth(authentication);
            PaiementAdhesion paiement = paiementAdhesionService.rejeterPaiement(id, adminId, dto.motif());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Paiement d'adhésion rejeté.",
                    "paiement", PaiementAdhesionDTO.fromEntity(paiement)
            ));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Récupérer le paiement d'adhésion d'un membre spécifique
     */
    @GetMapping("/membre/{membreId}")
    @PreAuthorize("hasAnyRole('TRESORIER', 'ADMIN')")
    public ResponseEntity<?> getPaiementByMembreId(@PathVariable Long membreId) {
        try {
            PaiementAdhesion paiement = paiementAdhesionService.getPaiementByMembreId(membreId);
            return ResponseEntity.ok(PaiementAdhesionDTO.fromEntity(paiement));
        } catch (com.madsi.backend.common.exception.NotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Récupérer tous les paiements (avec pagination)
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('TRESORIER', 'ADMIN')")
    public ResponseEntity<PageResponse<PaiementAdhesion>> getAllPaiements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        PageResponse<PaiementAdhesion> paiements = paiementAdhesionService.getAllPaiements(page, size);
        return ResponseEntity.ok(paiements);
    }

    /**
     * Méthode utilitaire pour récupérer l'ID du membre connecté
     */
    private Long getMembreIdFromAuth(Authentication authentication) {
        String username = authentication.getName();
        Membre membre = membreRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Membre non trouvé"));
        return membre.getId();
    }
}
