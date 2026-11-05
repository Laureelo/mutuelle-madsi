import { Routes } from '@angular/router';

export const RAPPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./rapports.component').then(m => m.RapportsComponent)
  }
];
