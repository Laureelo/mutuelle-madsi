// src/main/java/com/madsi/backend/operations/OperationMapper.java
package com.madsi.backend.operations;

import org.springframework.stereotype.Component;

import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.operations.dto.OperationDTO;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class OperationMapper {
    private final RecuRepository recuRepo;
    private final MembreRepository membreRepo;

    public OperationDTO toDTO(Operation op){
        var recu = recuRepo.findTopByOperationIdOrderByIdDesc(op.getId()).orElse(null);
        
        // Récupérer les informations du membre si disponible
        String membreNom = null;
        String membrePrenom = null;
        if (op.getMembreId() != null) {
            var membre = membreRepo.findById(op.getMembreId()).orElse(null);
            if (membre != null) {
                membreNom = membre.getLastName();
                membrePrenom = membre.getFirstName();
            }
        }
        
        return new OperationDTO(
                op.getId(),
                op.getDateOp(),
                op.getMontant(),
                op.getSens(),
                op.getTypeOp(),
                op.getModePaiement(),
                op.getReference(),
                op.getStatut(),
                op.getMembreId(),
                op.getObjetType(),
                op.getObjetId(),
                recu == null ? null : recu.getId(),
                membreNom,
                membrePrenom,
                op.getPhotoPreuve()
        );
    }
}