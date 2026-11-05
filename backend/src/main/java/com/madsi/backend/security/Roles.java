package com.madsi.backend.security;

/** Rôles applicatifs (sans préfixe ROLE_) */
public final class Roles {
    private Roles(){}

    public static final String VISITEUR    = "VISITEUR";
    public static final String MEMBRE      = "MEMBRE";
    public static final String TRESORIER   = "TRESORIER";
    public static final String COMMISSAIRE = "COMMISSAIRE";
    public static final String ADMIN       = "ADMIN";

    /** Rôles d'un compte actif (peuvent faire leurs démarches de membre). */
    public static final String[] ACTIFS = {MEMBRE, TRESORIER, COMMISSAIRE, ADMIN};
    /** Rôles qui consultent la trésorerie (lecture). */
    public static final String[] LECTEURS_FINANCES = {TRESORIER, COMMISSAIRE, ADMIN};
    /** Rôles qui consultent la liste des membres. */
    public static final String[] CONSULTENT_MEMBRES = {TRESORIER, ADMIN};

    public static String asSpring(String role){
        return role.startsWith("ROLE_") ? role : "ROLE_" + role;
    }
}
