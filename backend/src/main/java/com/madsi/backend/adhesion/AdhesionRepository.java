package com.madsi.backend.adhesion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdhesionRepository extends JpaRepository<Adhesion, Long> {

    /**
     * Vérifier si un membre a déjà une adhésion validée
     */
    boolean existsByMembreIdAndStatut(Long membreId, Adhesion.StatutAdhesion statut);

    /**
     * Récupérer toutes les adhésions d'un membre
     */
    List<Adhesion> findByMembreId(Long membreId);

    /**
     * Récupérer l'adhésion validée d'un membre
     */
    Optional<Adhesion> findByMembreIdAndStatut(Long membreId, Adhesion.StatutAdhesion statut);

    /**
     * Récupérer toutes les adhésions en attente de validation
     */
    List<Adhesion> findByStatut(Adhesion.StatutAdhesion statut);

    /**
     * Compter les adhésions en attente
     */
    @Query("SELECT COUNT(a) FROM Adhesion a WHERE a.statut = 'EN_ATTENTE'")
    long countEnAttente();

    /**
     * Compter les adhésions validées
     */
    @Query("SELECT COUNT(a) FROM Adhesion a WHERE a.statut = 'VALIDE'")
    long countValidees();

    /**
     * Vérifier si un membre a une adhésion (peu importe le statut)
     */
    boolean existsByMembreId(Long membreId);
}
