import { Routes } from '@angular/router';
import { roleGuard, ROLES_FINANCES } from '../../guards/role.guard';

export const COTISATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./cotisations-list.component').then(m => m.CotisationsListComponent)
  },
  {
    path: 'mes-cotisations',
    loadComponent: () => import('./cotisation-membre.component').then(m => m.CotisationMembreComponent)
  },
  {
    path: 'tresorier',
    canActivate: [roleGuard(...ROLES_FINANCES)],
    loadComponent: () => import('./cotisation-tresorier.component').then(m => m.CotisationTresorierComponent)
  }
];
