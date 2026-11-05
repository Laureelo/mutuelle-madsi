import { Routes } from '@angular/router';

export const PROFIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./profil.component').then(m => m.ProfilComponent)
  }
];
