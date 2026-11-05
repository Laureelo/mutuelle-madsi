package com.madsi.backend.manifestations;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TypeActiviteRepository extends JpaRepository<TypeActivite, Long> {
    java.util.List<TypeActivite> findByType(com.madsi.backend.common.Enums.TypeActiviteCat type);
}