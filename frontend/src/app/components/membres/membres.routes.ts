import { Routes } from '@angular/router';
import { roleGuard } from '../../guards/role.guard';

export const MEMBRES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./membres-list.component').then(m => m.MembresListComponent)
  },
  {
    path: 'nouveau',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./membre-form.component').then(m => m.MembreFormComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./membre-detail.component').then(m => m.MembreDetailComponent)
  },
  {
    path: ':id/edit',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./membre-form.component').then(m => m.MembreFormComponent)
  }
];
