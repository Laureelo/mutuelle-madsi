// src/main/java/com/madsi/backend/operations/OperationRepository.java
package com.madsi.backend.operations;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.Enums.TypeOperation;
import com.madsi.backend.common.Enums.OpStatut;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor; // ← AJOUT
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

// ⭐ SEULE MODIFICATION : Ajoutez JpaSpecificationExecutor
public interface OperationRepository extends
        JpaRepository<Operation, Long>,
        JpaSpecificationExecutor<Operation> { // ← AJOUT ICI

    long countByStatut(com.madsi.backend.common.Enums.OpStatut statut);

    // TOUT LE RESTE DE VOTRE CODE RESTE IDENTIQUE
    Optional<Operation> findTopByObjetTypeAndObjetIdAndTypeOpOrderByIdDesc(
            String objetType, Long objetId, TypeOperation typeOp);

    // Vérifier si un membre a des opérations
    boolean existsByMembreId(Long membreId);

    @Query("""
      SELECT COALESCE(SUM(o.montant), 0)
      FROM Operation o
      WHERE o.typeOp = com.madsi.backend.common.Enums.TypeOperation.DEPENSE
        AND o.sens   = com.madsi.backend.common.Enums.SensOp.SORTIE
        AND o.objetType = 'manifestation'
        AND o.objetId   = :manifId
        AND o.statut = com.madsi.backend.common.Enums.OpStatut.ENREGISTREE
    """)
    BigDecimal sumDepensesForManifestation(@Param("manifId") Long manifId);

    // ⭐ AJOUT : Chargement optimisé par période (exclut les opérations ANNULEE)
    @Query("""
      SELECT o FROM Operation o
      WHERE o.statut = com.madsi.backend.common.Enums.OpStatut.ENREGISTREE
        AND o.dateOp >= :from AND o.dateOp < :to
    """)
    List<Operation> findAllInPeriodExcludingCancelled(
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to
    );

    @Query("""
       SELECT COALESCE(SUM(CASE WHEN o.sens = com.madsi.backend.common.Enums.SensOp.ENTREE THEN o.montant ELSE 0 END),0)
         - COALESCE(SUM(CASE WHEN o.sens = com.madsi.backend.common.Enums.SensOp.SORTIE THEN o.montant ELSE 0 END),0)
       FROM Operation o
       WHERE FUNCTION('DATE', o.dateOp) >= :start 
         AND FUNCTION('DATE', o.dateOp) < :end
         AND o.statut = com.madsi.backend.common.Enums.OpStatut.ENREGISTREE
    """)
    BigDecimal soldeBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);



    @Query(value = """
      SELECT EXTRACT(MONTH FROM o.date_op) AS m,
             COALESCE(SUM(CASE WHEN o.sens = 'ENTREE' THEN o.montant END), 0) AS entrees,
             COALESCE(SUM(CASE WHEN o.sens = 'SORTIE' THEN o.montant END), 0) AS sorties
      FROM operations o
      WHERE EXTRACT(YEAR FROM o.date_op) = :year
        AND o.statut = 'ENREGISTREE'
      GROUP BY EXTRACT(MONTH FROM o.date_op)
      ORDER BY m
    """, nativeQuery = true)
    List<Object[]> monthlyCashflow(@Param("year") int year);
    // ⭐ AJOUT : Somme par type d'opération
    @Query("""
      SELECT o.typeOp, SUM(o.montant)
      FROM Operation o
      WHERE FUNCTION('YEAR', o.dateOp) = :year
      GROUP BY o.typeOp
    """)
    List<Object[]> sommeParType(@Param("year") int year);

    // ⭐ AJOUT : Top dépenses
    @Query("""
      SELECT o.typeOp, SUM(o.montant) as total
      FROM Operation o
      WHERE o.sens = com.madsi.backend.common.Enums.SensOp.SORTIE
        AND FUNCTION('YEAR', o.dateOp) = :year
      GROUP BY o.typeOp
      ORDER BY total DESC
    """)
    List<Object[]> topDepenses(@Param("year") int year);

    // ⭐ AJOUT : Méthodes pour les stats
    @Query("""
       SELECT COALESCE(SUM(o.montant),0)
       FROM Operation o
       WHERE o.sens = :sens 
         AND FUNCTION('DATE', o.dateOp) >= :start 
         AND FUNCTION('DATE', o.dateOp) < :end
         AND o.statut = com.madsi.backend.common.Enums.OpStatut.ENREGISTREE
    """)
    BigDecimal sumBySensBetween(@Param("sens") Enums.SensOp sens,
                                @Param("start") LocalDate start,
                                @Param("end") LocalDate end);

    @Query("""
      SELECT COALESCE(SUM(o.montant),0)
      FROM Operation o
      WHERE o.typeOp = :type
        AND FUNCTION('DATE', o.dateOp) >= :start 
        AND FUNCTION('DATE', o.dateOp) < :end
        AND o.statut = com.madsi.backend.common.Enums.OpStatut.ENREGISTREE
    """)
    BigDecimal sumByTypeBetween(@Param("type") Enums.TypeOperation type,
                                @Param("start") LocalDate start,
                                @Param("end") LocalDate end);

    @Query("""
      SELECT COALESCE(SUM(o.montant),0)
      FROM Operation o
      WHERE o.sens = :sens AND o.dateOp < :dateBefore
        AND o.statut = com.madsi.backend.common.Enums.OpStatut.ENREGISTREE
    """)
    BigDecimal sumBySensAndDateBefore(@Param("sens") Enums.SensOp sens,
                                      @Param("dateBefore") OffsetDateTime dateBefore);

    @Query("""
      SELECT COALESCE(SUM(o.montant),0)
      FROM Operation o
      WHERE o.typeOp = :type AND o.dateOp < :dateBefore
        AND o.statut = com.madsi.backend.common.Enums.OpStatut.ENREGISTREE
    """)
    BigDecimal sumByTypeAndDateBefore(@Param("type") Enums.TypeOperation type,
                                      @Param("dateBefore") OffsetDateTime dateBefore);
}