package com.madsi.backend.prets;

import com.madsi.backend.common.Enums;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface RemboursementRepository extends JpaRepository<RemboursementPret, Long> {

    List<RemboursementPret> findByEcheanceIdOrderByDatePaiementAsc(Long echeanceId);

    @Query("""
       SELECT COALESCE(SUM(r.montant),0)
       FROM RemboursementPret r
       WHERE r.echeanceId = :echId
         AND r.statut = com.madsi.backend.common.Enums.RemStatut.ENREGISTRE
    """)
    BigDecimal sumByEcheance(@Param("echId") Long echeanceId);
    List<RemboursementPret> findByEcheanceIdAndStatut(Long echeanceId, Enums.RemStatut statut);
    
    // Récupérer tous les remboursements en attente
    List<RemboursementPret> findByStatutOrderByDatePaiementDesc(Enums.RemStatut statut);
}