import { Routes } from '@angular/router';
import { roleGuard } from '../../guards/role.guard';

export const ADHESIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./adhesion-visiteur.component').then(m => m.AdhesionVisiteurComponent)
  },
  {
    path: 'tresorier',
    canActivate: [roleGuard('TRESORIER', 'ADMIN')],
    loadComponent: () => import('./adhesion-tresorier.component').then(m => m.AdhesionTresorierComponent)
  }
];

