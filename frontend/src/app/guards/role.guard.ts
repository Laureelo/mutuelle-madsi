import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protège une page par rôle : `canActivate: [roleGuard('ADMIN', 'TRESORIER')]`.
 * - non connecté (ou session expirée) -> page de connexion ;
 * - connecté sans le bon rôle -> tableau de bord.
 * Le serveur contrôle de toute façon chaque appel : ce garde évite surtout d'afficher des pages inutilisables.
 */
export const roleGuard = (...roles: string[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }
  if (authService.hasAnyRole(roles)) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};

/** Rôles d'un compte actif (peuvent faire leurs démarches de membre). */
export const ROLES_ACTIFS = ['MEMBRE', 'TRESORIER', 'COMMISSAIRE', 'ADMIN'];
/** Rôles qui consultent la trésorerie. */
export const ROLES_FINANCES = ['TRESORIER', 'COMMISSAIRE', 'ADMIN'];
/** Rôles qui consultent la liste des membres. */
export const ROLES_MEMBRES = ['TRESORIER', 'ADMIN'];
