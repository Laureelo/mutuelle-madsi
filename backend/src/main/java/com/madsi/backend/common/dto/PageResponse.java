package com.madsi.backend.common.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/** Enveloppe de pagination simple (page courante, taille, totaux). */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
){
    public static <T> PageResponse<T> of(Page<T> p) {
        return new PageResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }
}
