// src/main/java/com/madsi/backend/historique/HistoriqueService.java
package com.madsi.backend.historique;

import com.madsi.backend.common.Enums.HistoType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service @RequiredArgsConstructor
public class HistoriqueService {
    private final HistoriqueRepository repo;

    public void enregistrer(Long membreId,
                            String action,
                            String details,
                            HistoType type) {
        this.enregistrer(membreId, action, details, type, null, null);
    }

    public void enregistrer(Long membreId,
                            String action,
                            String details,
                            HistoType type,
                            String objetType,
                            Long objetId) {
        var h = Historique.builder()
                .membreId(membreId)
                .action(action)
                .details(details)
                .type(type)
                .objetType(objetType)
                .objetId(objetId)
                .dateEvt(java.time.OffsetDateTime.now())
                .build();
        repo.save(h);
    }

    public Page<Historique> list(Long membreId, int page, int size){
        return repo.findByMembreIdOrderByDateEvtDesc(membreId, PageRequest.of(page, size));
    }
}
