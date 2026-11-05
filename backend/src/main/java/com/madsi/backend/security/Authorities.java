package com.madsi.backend.security;

public final class Authorities {
    private Authorities(){}

    public static final String ROLE_VISITEUR    = "ROLE_" + Roles.VISITEUR;
    public static final String ROLE_MEMBRE      = "ROLE_" + Roles.MEMBRE;
    public static final String ROLE_TRESORIER   = "ROLE_" + Roles.TRESORIER;
    public static final String ROLE_COMMISSAIRE = "ROLE_" + Roles.COMMISSAIRE;
    public static final String ROLE_ADMIN       = "ROLE_" + Roles.ADMIN;
}
