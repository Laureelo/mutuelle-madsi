package com.madsi.backend.security;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.RoleMembre;

/**
 * Règle unique pour déterminer le rôle réellement exercé par un compte.
 *
 * - Compte désactivé (INACTIF) : aucun accès (retourne null).
 * - Compte non encore activé (VISITEUR, EN_ATTENTE, VALIDE_PAR_TRESORERIE) : traité comme VISITEUR,
 *   même si un rôle plus élevé a été saisi par erreur. Sans paiement de l'adhésion validé et
 *   activation par l'administrateur, l'accès reste restreint.
 * - Compte ACTIF : le rôle enregistré.
 */
public final class AccountPolicy {
    private AccountPolicy(){}

    public static RoleMembre effectiveRole(Membre m) {
        if (m == null || m.getEtatCompte() == null || m.getRole() == null) return null;
        if (m.getEtatCompte() == Enums.EtatCompte.INACTIF) return null;
        if (m.getEtatCompte() != Enums.EtatCompte.ACTIF) return RoleMembre.VISITEUR;
        return m.getRole();
    }
}
