package com.madsi.backend.cotisations;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CotisationRepository extends JpaRepository<Cotisation, Long>, JpaSpecificationExecutor<Cotisation> {
    // Recherche des cotisations d'un membre, triées par la première période
    @Query("SELECT c FROM Cotisation c WHERE c.membreId = :membreId ORDER BY c.periodes DESC")
    List<Cotisation> findByMembreIdOrderByPeriodeDesc(@Param("membreId") Long membreId);

    // Vérifier si une cotisation existe déjà pour un membre et une période
    // Recherche exacte dans la liste CSV : soit au début, soit après une virgule, soit seul
    // Gère les espaces autour des virgules et des périodes
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Cotisation c " +
           "WHERE c.membreId = :membreId AND " +
           "(TRIM(c.periodes) = :periode " +
           "OR TRIM(c.periodes) LIKE CONCAT(:periode,',%') " +
           "OR TRIM(c.periodes) LIKE CONCAT('%,',:periode,',%') " +
           "OR TRIM(c.periodes) LIKE CONCAT('%,',:periode) " +
           "OR c.periodes LIKE CONCAT('%',:periode,'%'))")
    boolean existsByMembreIdAndPeriode(@Param("membreId") Long membreId, @Param("periode") String periode);

    // Vérifier si un membre a des cotisations
    boolean existsByMembreId(Long membreId);

    // Récupérer une cotisation par membre et période
    // Recherche exacte dans la liste CSV : soit au début, soit après une virgule, soit seul
    // Gère les espaces autour des virgules et des périodes
    @Query("SELECT c FROM Cotisation c " +
           "WHERE c.membreId = :membreId AND " +
           "(TRIM(c.periodes) = :periode " +
           "OR TRIM(c.periodes) LIKE CONCAT(:periode,',%') " +
           "OR TRIM(c.periodes) LIKE CONCAT('%,',:periode,',%') " +
           "OR TRIM(c.periodes) LIKE CONCAT('%,',:periode) " +
           "OR c.periodes LIKE CONCAT('%',:periode,'%'))")
    java.util.Optional<Cotisation> findByMembreIdAndPeriode(@Param("membreId") Long membreId, @Param("periode") String periode);

    // Récupérer les cotisations par statut, triées par date décroissante
    @Query("SELECT c FROM Cotisation c WHERE c.statut = :statut ORDER BY c.datePaiement DESC, c.id DESC")
    List<Cotisation> findByStatutOrderByDatePaiementDesc(@Param("statut") com.madsi.backend.common.Enums.CotiStatut statut);
    
    // Récupérer les cotisations par statut (ancienne méthode pour compatibilité)
    List<Cotisation> findByStatut(com.madsi.backend.common.Enums.CotiStatut statut);

    List<Cotisation> findByStatutIn(java.util.Collection<com.madsi.backend.common.Enums.CotiStatut> statuts);
    
    // Récupérer toutes les cotisations triées par date décroissante
    @Query("SELECT c FROM Cotisation c ORDER BY c.datePaiement DESC, c.id DESC")
    List<Cotisation> findAllOrderByDatePaiementDesc();

    // Récupérer les cotisations d'un membre par statut
    @Query("SELECT c FROM Cotisation c WHERE c.membreId = :membreId AND c.statut = :statut")
    List<Cotisation> findByMembreIdAndStatut(@Param("membreId") Long membreId, @Param("statut") com.madsi.backend.common.Enums.CotiStatut statut);

    // Recherche admin avec filtres facultatifs
    @Query("""
      SELECT c FROM Cotisation c
      WHERE (:mois IS NULL OR :mois = '' OR c.periodes LIKE CONCAT('%',:mois,'%'))
        AND (:mode IS NULL OR :mode = '' OR CAST(c.modePaiement AS string) = :mode)
        AND (:statut IS NULL OR :statut = '' OR CAST(c.statut AS string) = :statut)
        AND (:memberIds IS NULL OR c.membreId IN :memberIds)
      ORDER BY c.datePaiement DESC, c.id DESC
    """)
    Page<Cotisation> searchAdmin(@Param("mois") String mois,
                                 @Param("mode") String mode,
                                 @Param("statut") String statut,
                                 @Param("memberIds") List<Long> memberIds,
                                 Pageable pageable);
}
