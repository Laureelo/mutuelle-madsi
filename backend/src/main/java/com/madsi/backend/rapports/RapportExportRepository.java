// src/main/java/com/madsi/backend/rapports/RapportExportRepository.java
package com.madsi.backend.rapports;

import com.madsi.backend.common.Enums;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RapportExportRepository extends JpaRepository<RapportExport, Long> {
    Page<RapportExport> findAllByOrderByGenereLeDesc(Pageable pageable);
    Page<RapportExport> findByType(Enums.RapportType type, Pageable pageable);
}
