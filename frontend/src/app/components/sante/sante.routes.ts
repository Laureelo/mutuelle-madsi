import { Routes } from '@angular/router';

export const SANTE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sante.component').then(m => m.SanteComponent)
  }
];
