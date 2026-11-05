package com.madsi.backend.participations;

import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.participations.dto.ParticipationRequest;
import com.madsi.backend.participations.dto.ParticipationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ParticipationService {

    private final ParticipationRepository participationRepository;
    private final MembreRepository membreRepository;

    /**
     * Confirmer la participation d'un membre à une manifestation
     */
    @Transactional
    public ParticipationResponse participer(Long manifestationId, Long membreId, ParticipationRequest request) {
        // Vérifier si le membre participe déjà
        if (participationRepository.existsByManifestationIdAndMembreId(manifestationId, membreId)) {
            throw new IllegalStateException("Vous participez déjà à cette manifestation");
        }

        // Créer la participation
        Participation participation = Participation.builder()
                .manifestationId(manifestationId)
                .membreId(membreId)
                .confirmation(request.getConfirmation() != null ? request.getConfirmation() : true)
                .nombreAccompagnants(request.getNombreAccompagnants() != null ? request.getNombreAccompagnants() : 0)
                .remarque(request.getRemarque())
                .dateInscription(LocalDateTime.now())
                .build();

        participation = participationRepository.save(participation);

        return mapToResponse(participation);
    }

    /**
     * Modifier la participation d'un membre
     */
    @Transactional
    public ParticipationResponse modifierParticipation(Long manifestationId, Long membreId, ParticipationRequest request) {
        Participation participation = participationRepository.findByManifestationIdAndMembreId(manifestationId, membreId)
                .orElseThrow(() -> new IllegalStateException("Vous ne participez pas à cette manifestation"));

        // Mettre à jour les informations
        if (request.getConfirmation() != null) {
            participation.setConfirmation(request.getConfirmation());
        }
        if (request.getNombreAccompagnants() != null) {
            participation.setNombreAccompagnants(request.getNombreAccompagnants());
        }
        if (request.getRemarque() != null) {
            participation.setRemarque(request.getRemarque());
        }

        participation = participationRepository.save(participation);

        return mapToResponse(participation);
    }

    /**
     * Annuler la participation d'un membre
     */
    @Transactional
    public void annulerParticipation(Long manifestationId, Long membreId) {
        if (!participationRepository.existsByManifestationIdAndMembreId(manifestationId, membreId)) {
            throw new IllegalStateException("Vous ne participez pas à cette manifestation");
        }

        participationRepository.deleteByManifestationIdAndMembreId(manifestationId, membreId);
    }

    /**
     * Obtenir la liste des participants à une manifestation
     */
    public List<ParticipationResponse> getParticipants(Long manifestationId) {
        List<Participation> participations = participationRepository.findByManifestationId(manifestationId);

        return participations.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Obtenir les participations d'un membre
     */
    public List<ParticipationResponse> getParticipationsByMembre(Long membreId) {
        List<Participation> participations = participationRepository.findByMembreId(membreId);

        return participations.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Compter le nombre de participants
     */
    public Long countParticipants(Long manifestationId) {
        return participationRepository.countByManifestationId(manifestationId);
    }

    /**
     * Compter le nombre total de personnes (participants + accompagnants)
     */
    public Long countTotalPersonnes(Long manifestationId) {
        return participationRepository.countTotalPersonnesByManifestationId(manifestationId);
    }

    /**
     * Vérifier si un membre participe
     */
    public boolean membreParticipe(Long manifestationId, Long membreId) {
        return participationRepository.existsByManifestationIdAndMembreId(manifestationId, membreId);
    }

    /**
     * Mapper Participation vers ParticipationResponse
     */
    private ParticipationResponse mapToResponse(Participation participation) {
        ParticipationResponse response = ParticipationResponse.builder()
                .id(participation.getId())
                .manifestationId(participation.getManifestationId())
                .membreId(participation.getMembreId())
                .confirmation(participation.getConfirmation())
                .nombreAccompagnants(participation.getNombreAccompagnants())
                .remarque(participation.getRemarque())
                .dateInscription(participation.getDateInscription())
                .build();

        // Charger les informations du membre
        membreRepository.findById(participation.getMembreId()).ifPresent(membre -> {
            response.setMembrePrenom(membre.getFirstName());
            response.setMembreNom(membre.getLastName());
            response.setMembrePhotoUrl(membre.getPhotoUrl());
        });

        return response;
    }
}
