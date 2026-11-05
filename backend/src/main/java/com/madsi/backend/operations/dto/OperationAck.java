// src/main/java/com/madsi/backend/operations/dto/OperationAck.java
package com.madsi.backend.operations.dto;

public record OperationAck(
        Long operationId,
        Long recuId,
        String recuNumero,
        String pdfUrl,
        boolean enAttenteConfirmation   // dépense au-dessus du seuil : en attente de la confirmation du président (admin)
) {
    public OperationAck(Long operationId, Long recuId, String recuNumero, String pdfUrl) {
        this(operationId, recuId, recuNumero, pdfUrl, false);
    }
}
