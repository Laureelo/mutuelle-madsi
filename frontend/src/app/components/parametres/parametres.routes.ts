import { Routes } from '@angular/router';

export const PARAMETRES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./parametres.component').then(m => m.ParametresComponent)
  }
];
