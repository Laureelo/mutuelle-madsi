package com.madsi.backend.security;

import com.madsi.backend.membres.MembreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * Contrôles d'accès « à la donnée » : un membre ne peut agir que sur ses propres données,
 * sauf rôles autorisés. Utilisable aussi dans les @PreAuthorize via @guard.
 */
@Component("guard")
@RequiredArgsConstructor
public class AccessGuard {

    private final MembreRepository membres;

    /** Id du membre connecté (déduit du jeton, jamais d'un paramètre envoyé par l'écran). */
    public Long currentMembreId() {
        String username = CurrentUser.username();
        if (username == null || "anonymousUser".equals(username)) {
            throw new AccessDeniedException("Authentification requise");
        }
        return membres.findByUsername(username)
                .map(m -> m.getId())
                .orElseThrow(() -> new AccessDeniedException("Compte introuvable"));
    }

    public boolean isSelf(Long membreId) {
        return membreId != null && membreId.equals(currentMembreId());
    }

    public boolean hasAnyRole(String... roles) {
        var mine = CurrentUser.roles();
        return Arrays.stream(roles).anyMatch(mine::contains);
    }

    /** Le membre lui-même OU l'un des rôles donnés. */
    public void ensureSelfOr(Long membreId, String... roles) {
        if (!isSelf(membreId) && !hasAnyRole(roles)) {
            throw new AccessDeniedException("Accès refusé à ces données");
        }
    }

    /** Le membre lui-même OU un lecteur de la trésorerie (trésorier, commissaire, admin). */
    public void ensureSelfOrFinance(Long membreId) {
        ensureSelfOr(membreId, Roles.LECTEURS_FINANCES);
    }

    /** Le membre lui-même OU quelqu'un qui consulte les membres (trésorier, admin). */
    public void ensureSelfOrStaff(Long membreId) {
        ensureSelfOr(membreId, Roles.CONSULTENT_MEMBRES);
    }

    /** Le membre lui-même OU le trésorier (saisie au guichet pour le compte d'un membre). */
    public void ensureSelfOrTresorier(Long membreId) {
        ensureSelfOr(membreId, Roles.TRESORIER);
    }
}
