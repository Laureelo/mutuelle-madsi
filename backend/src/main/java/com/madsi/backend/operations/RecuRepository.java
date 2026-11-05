package com.madsi.backend.operations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RecuRepository extends JpaRepository<Recu, Long> {
    Optional<Recu> findTopByOperationIdOrderByIdDesc(Long operationId);
}