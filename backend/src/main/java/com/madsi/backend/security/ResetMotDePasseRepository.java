package com.madsi.backend.security;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface ResetMotDePasseRepository extends JpaRepository<ResetMotDePasse, Long> {

    Optional<ResetMotDePasse> findByEmpreinte(String empreinte);

    long countByMembreIdAndCreeLeAfter(Long membreId, LocalDateTime depuis);

    /** Supprime les demandes expirées depuis longtemps. */
    @Modifying
    @Query("delete from ResetMotDePasse r where r.expireLe < :limite")
    int purger(@Param("limite") LocalDateTime limite);

    /** Les anciens liens de ce membre cessent de fonctionner quand un nouveau est émis. */
    @Modifying
    @Query("update ResetMotDePasse r set r.utilise = true where r.membreId = :membreId and r.utilise = false")
    int invaliderAnciens(@Param("membreId") Long membreId);
}
