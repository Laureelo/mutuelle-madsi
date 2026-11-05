package com.madsi.backend.mail;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface EmailLogRepository extends JpaRepository<EmailLog, Long> {

    long countByStatutAndDateEnvoiAfter(String statut, LocalDateTime depuis);

    List<EmailLog> findTop20ByOrderByDateEnvoiDesc();

    List<EmailLog> findTop5ByStatutOrderByDateEnvoiDesc(String statut);
}
