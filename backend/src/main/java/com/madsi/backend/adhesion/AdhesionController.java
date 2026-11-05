package com.madsi.backend.adhesion;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller pour la gestion des adhésions MADSI (paiement de 2000 FCFA)
 */
@RestController
@RequestMapping("/api/adhesions")
@RequiredArgsConstructor
public class AdhesionController {

    private final AdhesionService adhesionService;
    private final MembreRepository membreRepository;

    /**
     * Déclarer un paiement d'adhésion (pour les membres VISITEUR)
     * Endpoint accessible à tous les membres authentifiés
     */
    @PostMapping("/declarer")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> declarer(
            @Valid @RequestBody DeclarationAdhesionDTO dto,
            Authentication authentication
    ) {
        try {
            Long membreId = getMembreIdFromAuth(authentication);

            Adhesion adhesion = adhesionService.declarer(
                    membreId,
                    dto.modePaiement(),
                    dto.reference(),
                    dto.remarque(),
                    dto.photoPreuve()
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "success", true,
                    "message", "Déclaration d'adhésion enregistrée avec succès. En attente de validation par la trésorerie.",
                    "adhesion", adhesion
            ));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Consulter mes adhésions (membre connecté)
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Adhesion>> getMesAdhesions(Authentication authentication) {
        Long membreId = getMembreIdFromAuth(authentication);
        List<Adhesion> adhesions = adhesionService.getByMembre(membreId);
        return ResponseEntity.ok(adhesions);
    }

    /**
     * Récupérer toutes les adhésions (pour trésorier/admin)
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('TRESORIER', 'ADMIN')")
    public ResponseEntity<List<Adhesion>> getAll() {
        List<Adhesion> adhesions = adhesionService.getAll();
        return ResponseEntity.ok(adhesions);
    }

    /**
     * Récupérer les adhésions en attente de validation
     */
    @GetMapping("/en-attente")
    @PreAuthorize("hasAnyRole('TRESORIER', 'ADMIN')")
    public ResponseEntity<List<Adhesion>> getEnAttente() {
        List<Adhesion> adhesions = adhesionService.getEnAttente();
        return ResponseEntity.ok(adhesions);
    }

    /**
     * Récupérer une adhésion par ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TRESORIER', 'ADMIN')")
    public ResponseEntity<Adhesion> getById(@PathVariable Long id) {
        Adhesion adhesion = adhesionService.getById(id);
        return ResponseEntity.ok(adhesion);
    }

    /**
     * Récupérer les adhésions d'un membre par son ID (pour trésorier/admin)
     */
    @GetMapping("/membre/{membreId}")
    @PreAuthorize("hasAnyRole('TRESORIER', 'ADMIN')")
    public ResponseEntity<List<Adhesion>> getByMembreId(@PathVariable Long membreId) {
        List<Adhesion> adhesions = adhesionService.getByMembre(membreId);
        return ResponseEntity.ok(adhesions);
    }

    /**
     * Valider une adhésion (trésorier uniquement)
     */
    @PostMapping("/{id}/valider")
    @PreAuthorize("hasRole('TRESORIER')")
    public ResponseEntity<?> valider(
            @PathVariable Long id,
            @RequestParam(required = false) Long tresorierId,
            Authentication authentication
    ) {
        try {
            // Le trésorier est identifié par le jeton (le paramètre tresorierId éventuel est ignoré)
            Adhesion adhesion = adhesionService.valider(id, getMembreIdFromAuth(authentication));
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Adhésion validée avec succès. Le membre est maintenant ACTIF.",
                    "adhesion", adhesion
            ));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Rejeter une adhésion (trésorier uniquement)
     */
    @PostMapping("/{id}/rejeter")
    @PreAuthorize("hasRole('TRESORIER')")
    public ResponseEntity<?> rejeter(
            @PathVariable Long id,
            @RequestBody @Valid RejetAdhesionDTO dto,
            Authentication authentication
    ) {
        try {
            Adhesion adhesion = adhesionService.rejeter(id, getMembreIdFromAuth(authentication), dto.motifRejet());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Adhésion rejetée.",
                    "adhesion", adhesion
            ));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Statistiques des adhésions
     */
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('TRESORIER', 'ADMIN')")
    public ResponseEntity<AdhesionService.AdhesionStats> getStats() {
        AdhesionService.AdhesionStats stats = adhesionService.getStats();
        return ResponseEntity.ok(stats);
    }

    /**
     * Obtenir l'ID du membre connecté depuis l'authentification
     */
    private Long getMembreIdFromAuth(Authentication authentication) {
        String username = authentication.getName();
        Membre membre = membreRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Membre introuvable"));
        return membre.getId();
    }

    // ===== DTOs =====

    public record DeclarationAdhesionDTO(
            @NotNull(message = "Le mode de paiement est requis")
            Enums.ModePaiement modePaiement,

            String reference,
            String remarque,
            String photoPreuve
    ) {}

    public record RejetAdhesionDTO(
            Long tresorierId, // ignoré : le trésorier est identifié par le jeton

            @NotBlank(message = "Le motif de rejet est requis")
            String motifRejet
    ) {}
}
