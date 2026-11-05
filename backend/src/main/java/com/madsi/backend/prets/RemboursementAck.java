package com.madsi.backend.prets;

public record RemboursementAck(
        Long remboursementId,
        Long operationId,
        Long recuId,
        String recuNumero,
        String recuUrl
) {}