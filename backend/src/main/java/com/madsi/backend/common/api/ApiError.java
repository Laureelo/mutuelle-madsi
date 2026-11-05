// src/main/java/com/madsi/backend/common/api/ApiError.java
package com.madsi.backend.common.api;

import java.time.OffsetDateTime;
import java.util.List;

public record ApiError(
        int status,
        String error,
        String message,
        String path,
        OffsetDateTime timestamp,
        List<FieldError> fieldErrors
) {
    public static record FieldError(String field, String message) {}
}