import { Routes } from '@angular/router';
import { roleGuard, ROLES_FINANCES } from '../../guards/role.guard';

export const PRETS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./prets-list.component').then(m => m.PretsListComponent)
  },
  {
    path: 'remboursement/:pretId',
    loadComponent: () => import('./remboursement-simple.component').then(m => m.RemboursementSimpleComponent)
  },
  {
    path: 'remboursements/pending',
    canActivate: [roleGuard(...ROLES_FINANCES)],
    loadComponent: () => import('./remboursements-pending.component').then(m => m.RemboursementsPendingComponent)
  }
];
