package com.madsi.backend.prets;

public record VerserAck(
        Pret pret,
        Long operationId,
        Long recuId,
        String recuUrl
) {}