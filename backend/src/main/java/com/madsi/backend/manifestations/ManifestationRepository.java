package com.madsi.backend.manifestations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ManifestationRepository extends JpaRepository<Manifestation, Long>, JpaSpecificationExecutor<Manifestation> {

    long countByStatut(com.madsi.backend.common.Enums.ManifStatut statut);

    java.util.List<Manifestation> findByMembreIdAndTypeActiviteIdIn(Long membreId, java.util.Collection<Long> typeActiviteIds);

    @Query("""
  SELECT t.type, COUNT(m)
  FROM Manifestation m
  JOIN TypeActivite t ON t.id = m.typeActiviteId
  WHERE FUNCTION('YEAR', m.date) = :year
  GROUP BY t.type
""")
    List<Object[]> repartitionParCategorie(@Param("year") int year);
}