// src/main/java/com/madsi/backend/historique/HistoriqueRepository.java
package com.madsi.backend.historique;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HistoriqueRepository extends JpaRepository<Historique, Long> {
    Page<Historique> findByMembreIdOrderByDateEvtDesc(Long membreId, Pageable pageable);

    // Vérifier si un membre a un historique
    boolean existsByMembreId(Long membreId);

    // Supprimer tout l'historique d'un membre
    void deleteByMembreId(Long membreId);
}
