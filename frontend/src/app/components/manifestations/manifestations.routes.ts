import { Routes } from '@angular/router';

export const MANIFESTATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./manifestations-list.component').then(m => m.ManifestationsListComponent)
  }
];
