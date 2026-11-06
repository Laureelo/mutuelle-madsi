package com.madsi.backend.membres;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.madsi.backend.common.Enums;

public interface MembreRepository extends JpaRepository<Membre, Long>, JpaSpecificationExecutor<Membre> {

    // --- pour l'auth
    Optional<Membre> findByUsername(String username);
    Optional<Membre> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByRole(RoleMembre role);
    long countByRoleAndEtatCompte(RoleMembre role, Enums.EtatCompte etat);


    @Query("""
    SELECT m.id FROM Membre m
    WHERE (:q IS NULL OR :q = '' OR
           LOWER(COALESCE(m.firstName,'')) LIKE LOWER(CONCAT('%',:q,'%')) OR
           LOWER(COALESCE(m.lastName ,'')) LIKE LOWER(CONCAT('%',:q,'%')) OR
           LOWER(COALESCE(m.email    ,'')) LIKE LOWER(CONCAT('%',:q,'%')))
  """)
    List<Long> searchIds(@Param("q") String q);

    // Impayés (laisse cette requête si tu as l’entité Cotisation)
    @Query("""
      SELECT m FROM Membre m
      WHERE m.etatCompte = com.madsi.backend.common.Enums.EtatCompte.ACTIF
        AND (
          :q IS NULL OR :q = '' OR
          LOWER(COALESCE(m.firstName,'')) LIKE LOWER(CONCAT('%',:q,'%')) OR
          LOWER(COALESCE(m.lastName ,'')) LIKE LOWER(CONCAT('%',:q,'%')) OR
          LOWER(COALESCE(m.email    ,'')) LIKE LOWER(CONCAT('%',:q,'%'))
        )
        AND NOT EXISTS (
          SELECT c FROM Cotisation c
          WHERE c.membreId = m.id
            AND c.periodes LIKE CONCAT('%',:mois,'%')
            AND c.statut IN (
              com.madsi.backend.common.Enums.CotiStatut.PAYE,
              com.madsi.backend.common.Enums.CotiStatut.PARTIEL
            )
        )
      ORDER BY COALESCE(m.lastName,''), COALESCE(m.firstName,''), m.id
    """)
    Page<Membre> findImpayesForMonth(@Param("mois") String mois,
                                     @Param("q") String q,
                                     Pageable pageable);

    List<Membre> findByEtatCompte(Enums.EtatCompte etat);

    // Stat des adhésions par mois d’une année donnée (sur la dateRegistered)
    @Query("""
       SELECT FUNCTION('MONTH', m.dateRegistered), COUNT(m)
       FROM Membre m
       WHERE FUNCTION('YEAR', m.dateRegistered) = :year
       GROUP BY FUNCTION('MONTH', m.dateRegistered)
       ORDER BY FUNCTION('MONTH', m.dateRegistered)
    """)
    List<Object[]> adhesionsParMois(@Param("year") int year);
}
