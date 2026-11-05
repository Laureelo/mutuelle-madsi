package com.madsi.backend.membres;

/**
 * Rôles possibles pour un membre (un seul rôle par compte).
 *
 * Hiérarchie : VISITEUR < MEMBRE < TRESORIER / COMMISSAIRE < ADMIN
 * (le « bureau » de la mutuelle, c'est le président = ADMIN et les trésoriers : il n'y a pas de rôle séparé)
 */
public enum RoleMembre {
    VISITEUR,    // Compte créé, adhésion pas encore validée/activée
    MEMBRE,      // Adhérent actif
    TRESORIER,   // Trésorier : valide les paiements, gère la caisse et les prêts
    COMMISSAIRE, // Commissaire aux comptes : lecture seule sur les finances
    ADMIN        // Administrateur : comptes, rôles, paramètres
}
