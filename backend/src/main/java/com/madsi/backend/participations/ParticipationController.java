package com.madsi.backend.participations;

import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.participations.dto.ParticipationRequest;
import com.madsi.backend.participations.dto.ParticipationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manifestations")
@RequiredArgsConstructor
public class ParticipationController {

    private final ParticipationService participationService;
    private final MembreRepository membreRepository;

    /**
     * Confirmer la participation à une manifestation
     */
    @PostMapping("/{manifestationId}/participer")
    public ResponseEntity<ParticipationResponse> participer(
            @PathVariable Long manifestationId,
            @RequestBody ParticipationRequest request,
            Authentication authentication
    ) {
        Long membreId = getMembreIdFromAuth(authentication);
        ParticipationResponse response = participationService.participer(manifestationId, membreId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Modifier sa participation
     */
    @PutMapping("/{manifestationId}/participer")
    public ResponseEntity<ParticipationResponse> modifierParticipation(
            @PathVariable Long manifestationId,
            @RequestBody ParticipationRequest request,
            Authentication authentication
    ) {
        Long membreId = getMembreIdFromAuth(authentication);
        ParticipationResponse response = participationService.modifierParticipation(manifestationId, membreId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Annuler sa participation
     */
    @DeleteMapping("/{manifestationId}/participer")
    public ResponseEntity<Void> annulerParticipation(
            @PathVariable Long manifestationId,
            Authentication authentication
    ) {
        Long membreId = getMembreIdFromAuth(authentication);
        participationService.annulerParticipation(manifestationId, membreId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtenir la liste des participants à une manifestation
     */
    @GetMapping("/{manifestationId}/participants")
    public ResponseEntity<List<ParticipationResponse>> getParticipants(
            @PathVariable Long manifestationId
    ) {
        List<ParticipationResponse> participants = participationService.getParticipants(manifestationId);
        return ResponseEntity.ok(participants);
    }

    /**
     * Obtenir le nombre de participants
     */
    @GetMapping("/{manifestationId}/participants/count")
    public ResponseEntity<ParticipantCount> getParticipantCount(
            @PathVariable Long manifestationId
    ) {
        Long count = participationService.countParticipants(manifestationId);
        Long totalPersonnes = participationService.countTotalPersonnes(manifestationId);

        ParticipantCount result = new ParticipantCount(count, totalPersonnes);
        return ResponseEntity.ok(result);
    }

    /**
     * Vérifier si le membre connecté participe
     */
    @GetMapping("/{manifestationId}/participer/status")
    public ResponseEntity<ParticipationStatus> getParticipationStatus(
            @PathVariable Long manifestationId,
            Authentication authentication
    ) {
        Long membreId = getMembreIdFromAuth(authentication);
        boolean participe = participationService.membreParticipe(manifestationId, membreId);

        ParticipationStatus status = new ParticipationStatus(participe);
        return ResponseEntity.ok(status);
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

    // DTOs pour les réponses
    record ParticipantCount(Long participants, Long totalPersonnes) {}
    record ParticipationStatus(boolean participe) {}
}
