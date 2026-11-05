package com.madsi.backend.common.exception;



/** 404 fonctionnelle (entité non trouvée). */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message){ super(message); }
}
