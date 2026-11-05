package com.madsi.backend.adhesions;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaiementAdhesionRepository extends JpaRepository<PaiementAdhesion, Long>, JpaSpecificationExecutor<PaiementAdhesion> {

    /**
     * Trouver le paiement d'adhésion par membre
     */
    Optional<PaiementAdhesion> findByMembreId(Long membreId);

    /**
     * Vérifier si un membre a déjà un paiement d'adhésion enregistré
     */
    boolean existsByMembreId(Long membreId);

    /**
     * Récupérer tous les paiements en attente de validation (pour l'admin métier)
     */
    Page<PaiementAdhesion> findByStatutOrderByDateEnregistrementDesc(
            PaiementAdhesion.StatutPaiementAdhesion statut,
            Pageable pageable
    );

    /**
     * Récupérer les paiements en attente (liste simple pour notification)
     */
    List<PaiementAdhesion> findByStatut(PaiementAdhesion.StatutPaiementAdhesion statut);

    /**
     * Compter les paiements par statut
     */
    long countByStatut(PaiementAdhesion.StatutPaiementAdhesion statut);

    /**
     * Récupérer les paiements enregistrés par un trésorier spécifique
     */
    Page<PaiementAdhesion> findByEnregistreParTresorierOrderByDateEnregistrementDesc(
            Long tresorerId,
            Pageable pageable
    );

    /**
     * Récupérer les paiements validés par un admin métier spécifique
     */
    Page<PaiementAdhesion> findByValideParAdminOrderByDateValidationAdminDesc(
            Long adminId,
            Pageable pageable
    );

    /**
     * Statistiques : Nombre de paiements d'adhésion par mois (année donnée)
     */
    @Query("""
        SELECT FUNCTION('MONTH', p.datePaiement), COUNT(p)
        FROM PaiementAdhesion p
        WHERE FUNCTION('YEAR', p.datePaiement) = :year
            AND p.statut = com.madsi.backend.adhesions.PaiementAdhesion.StatutPaiementAdhesion.VALIDE
        GROUP BY FUNCTION('MONTH', p.datePaiement)
        ORDER BY FUNCTION('MONTH', p.datePaiement)
    """)
    List<Object[]> paiementsParMois(@Param("year") int year);

    /**
     * Trouver les paiements par mode de paiement
     */
    List<PaiementAdhesion> findByModePaiement(com.madsi.backend.common.Enums.ModePaiement modePaiement);

    /**
     * Statistiques : Montant total des adhésions validées
     */
    @Query("""
        SELECT SUM(p.montant)
        FROM PaiementAdhesion p
        WHERE p.statut = com.madsi.backend.adhesions.PaiementAdhesion.StatutPaiementAdhesion.VALIDE
    """)
    java.math.BigDecimal montantTotalAdhesionsValidees();
}
