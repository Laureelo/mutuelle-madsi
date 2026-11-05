package com.madsi.backend.prets;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.madsi.backend.common.Enums.PretStatut;

public interface PretRepository extends JpaRepository<Pret, Long>, JpaSpecificationExecutor<Pret> {
    List<Pret> findByMembreIdOrderByIdDesc(Long membreId);
    List<Pret> findByStatut(PretStatut statut);
    Page<Pret> findByStatut(PretStatut statut, Pageable pageable);
    long countByStatut(PretStatut statut);

    // Vérifier si un membre a des prêts
    boolean existsByMembreId(Long membreId);
}
