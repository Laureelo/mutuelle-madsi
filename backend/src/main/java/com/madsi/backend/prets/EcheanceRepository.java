package com.madsi.backend.prets;

import com.madsi.backend.common.Enums.EchStatut;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface EcheanceRepository extends JpaRepository<Echeance, Long> {

    List<Echeance> findByPretIdOrderByNumeroAsc(Long pretId);

    long countByPretIdAndStatutNot(Long pretId, EchStatut statut);

    /** J0 : dues exactement à la date (non PAYE) */
    @Query("""
       SELECT e FROM Echeance e
       WHERE e.dateEcheance = :date
         AND e.statut <> com.madsi.backend.common.Enums.EchStatut.PAYE
       ORDER BY e.numero ASC
    """)
    List<Echeance> findDueOn(@Param("date") LocalDate date);

    /** J-N : dues dans un intervalle [start, end] inclus (non PAYE) */
    @Query("""
       SELECT e FROM Echeance e
       WHERE e.dateEcheance BETWEEN :start AND :end
         AND e.statut <> com.madsi.backend.common.Enums.EchStatut.PAYE
       ORDER BY e.dateEcheance ASC, e.numero ASC
    """)
    List<Echeance> findDueBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    /** Retards : toutes les échéances en retard (< date), non PAYE */
    @Query("""
       SELECT e FROM Echeance e
       WHERE e.dateEcheance < :before
         AND e.statut <> com.madsi.backend.common.Enums.EchStatut.PAYE
       ORDER BY e.dateEcheance ASC, e.numero ASC
    """)
    List<Echeance> findOverdueBefore(@Param("before") LocalDate before);

    /** Supprime toutes les échéances d'un prêt */
    void deleteByPretId(Long pretId);
}