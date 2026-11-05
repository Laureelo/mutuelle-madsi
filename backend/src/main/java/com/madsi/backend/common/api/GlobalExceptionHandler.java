// src/main/java/com/madsi/backend/common/api/GlobalExceptionHandler.java
package com.madsi.backend.common.api;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.security.LoginAttemptService.TooManyAttemptsException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

/**
 * Point unique de traduction des erreurs en réponses JSON {status, error, message, path, timestamp, fieldErrors}.
 * Les détails techniques ne sont jamais renvoyés au client : ils sont écrits dans les journaux du serveur.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static ResponseEntity<ApiError> build(HttpStatus status, String code, String message,
                                                  HttpServletRequest req, List<ApiError.FieldError> fields) {
        var body = new ApiError(status.value(), code, message, req.getRequestURI(), OffsetDateTime.now(), fields);
        return ResponseEntity.status(status).body(body);
    }

    // ---------- 400 ----------
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> beanValidation(MethodArgumentNotValidException ex, HttpServletRequest req){
        var fields = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
                .collect(Collectors.toList());
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Requête invalide", req, fields);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> constraintViolation(ConstraintViolationException ex, HttpServletRequest req){
        var fields = ex.getConstraintViolations().stream()
                .map(v -> new ApiError.FieldError(String.valueOf(v.getPropertyPath()), v.getMessage()))
                .collect(Collectors.toList());
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Requête invalide", req, fields);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> typeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest req){
        return build(HttpStatus.BAD_REQUEST, "TYPE_MISMATCH", "Paramètre invalide: " + ex.getName(), req, null);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> missingParam(MissingServletRequestParameterException ex, HttpServletRequest req){
        return build(HttpStatus.BAD_REQUEST, "MISSING_PARAMETER", "Paramètre manquant: " + ex.getParameterName(), req, null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException ex, HttpServletRequest req){
        return build(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Corps de requête illisible ou valeur invalide", req, null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> illegalArg(IllegalArgumentException ex, HttpServletRequest req){
        return build(HttpStatus.BAD_REQUEST, "BAD_REQUEST", ex.getMessage(), req, null);
    }

    // ---------- 401 ----------
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> badCredentials(BadCredentialsException ex, HttpServletRequest req){
        return build(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Nom d'utilisateur ou mot de passe incorrect", req, null);
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ApiError> disabled(DisabledException ex, HttpServletRequest req){
        return build(HttpStatus.UNAUTHORIZED, "ACCOUNT_NOT_ACTIVE", ex.getMessage(), req, null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> authenticationError(AuthenticationException ex, HttpServletRequest req){
        return build(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "Échec de l'authentification", req, null);
    }

    // ---------- 403 ----------
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> accessDenied(AccessDeniedException ex, HttpServletRequest req){
        return build(HttpStatus.FORBIDDEN, "FORBIDDEN", "Vous n'avez pas le droit d'effectuer cette action.", req, null);
    }

    // ---------- 404 ----------
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> notFound(NotFoundException ex, HttpServletRequest req){
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage(), req, null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> noResource(NoResourceFoundException ex, HttpServletRequest req){
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ressource introuvable", req, null);
    }

    @ExceptionHandler(java.util.NoSuchElementException.class)
    public ResponseEntity<ApiError> noSuchElement(java.util.NoSuchElementException ex, HttpServletRequest req){
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", "Élément introuvable", req, null);
    }

    // ---------- 405 ----------
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> methodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest req){
        return build(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "Méthode non autorisée", req, null);
    }

    // ---------- 409 ----------
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> illegalState(IllegalStateException ex, HttpServletRequest req){
        return build(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), req, null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> dataIntegrity(DataIntegrityViolationException ex, HttpServletRequest req){
        log.warn("Violation d'intégrité sur {} : {}", req.getRequestURI(), ex.getMostSpecificCause().getMessage());

        String message = "Contrainte de données violée";
        String lowerMsg = String.valueOf(ex.getMessage()).toLowerCase();
        // Patterns précis PostgreSQL d'abord (le SQL INSERT contient tous les noms de colonnes)
        if (lowerMsg.contains("key (username)") || lowerMsg.contains("membres_username_key")
                || (lowerMsg.contains("uk_") && lowerMsg.contains("username"))) {
            message = "Ce nom d'utilisateur est déjà utilisé";
        } else if (lowerMsg.contains("key (email)") || lowerMsg.contains("membres_email_key")
                || (lowerMsg.contains("uk_") && lowerMsg.contains("email"))) {
            message = "Cet email est déjà utilisé";
        } else if (lowerMsg.contains("matricule")) {
            message = "Ce matricule est déjà utilisé";
        } else if (lowerMsg.contains("membre_id") && lowerMsg.contains("periode")) {
            message = "Une cotisation existe déjà pour ce membre pour cette période";
        } else if (lowerMsg.contains("numero") && lowerMsg.contains("recu")) {
            message = "Erreur de génération du reçu. Veuillez réessayer.";
        } else if (lowerMsg.contains("uk_echeance") || (lowerMsg.contains("echeance") && lowerMsg.contains("numero"))) {
            message = "L'échéancier existe déjà pour ce prêt. Le prêt a peut-être déjà été décaissé.";
        } else if (lowerMsg.contains("fk_") || lowerMsg.contains("foreign key")) {
            message = "Cet élément est lié à d'autres données et ne peut pas être modifié ou supprimé.";
        } else if (lowerMsg.contains("unique") || lowerMsg.contains("duplicate")) {
            message = "Une valeur unique est déjà utilisée. Vérifiez les données saisies.";
        }
        return build(HttpStatus.CONFLICT, "DATA_INTEGRITY_VIOLATION", message, req, null);
    }

    // ---------- 429 ----------
    @ExceptionHandler(TooManyAttemptsException.class)
    public ResponseEntity<ApiError> tooMany(TooManyAttemptsException ex, HttpServletRequest req){
        return build(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS", ex.getMessage(), req, null);
    }

    // ---------- 500 ----------
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> generic(Exception ex, HttpServletRequest req){
        // Le détail reste dans les journaux du serveur ; le client reçoit un message neutre.
        log.error("Erreur interne sur {} {}", req.getMethod(), req.getRequestURI(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "SERVER_ERROR",
                "Une erreur interne est survenue. Veuillez réessayer ou contacter l'administrateur.", req, null);
    }
}
