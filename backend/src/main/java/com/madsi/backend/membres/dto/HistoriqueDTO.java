package com.madsi.backend.membres.dto;

public record HistoriqueDTO(
        Long id,
        Long membreId,
        String type,         // Enum en String (COTISATION, PRET, ...)
        String action,
        String details,
        String dateEvt    // ISO (ex: "2025-10-21T14:22:00")
) {}