package com.madsi.backend.participations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParticipationRepository extends JpaRepository<Participation, Long> {

    /**
     * Trouver toutes les participations pour une manifestation donnée
     */
    List<Participation> findByManifestationId(Long manifestationId);

    /**
     * Trouver toutes les participations d'un membre
     */
    List<Participation> findByMembreId(Long membreId);

    /**
     * Trouver une participation spécifique (manifestation + membre)
     */
    Optional<Participation> findByManifestationIdAndMembreId(Long manifestationId, Long membreId);

    /**
     * Vérifier si un membre participe déjà à une manifestation
     */
    boolean existsByManifestationIdAndMembreId(Long manifestationId, Long membreId);

    /**
     * Compter le nombre de participants pour une manifestation
     */
    @Query("SELECT COUNT(p) FROM Participation p WHERE p.manifestationId = :manifestationId AND p.confirmation = true")
    Long countByManifestationId(@Param("manifestationId") Long manifestationId);

    /**
     * Calculer le nombre total de personnes (participants + accompagnants)
     */
    @Query("SELECT COALESCE(SUM(p.nombreAccompagnants + 1), 0) FROM Participation p WHERE p.manifestationId = :manifestationId AND p.confirmation = true")
    Long countTotalPersonnesByManifestationId(@Param("manifestationId") Long manifestationId);

    /**
     * Supprimer une participation
     */
    void deleteByManifestationIdAndMembreId(Long manifestationId, Long membreId);
}
