import { Routes } from '@angular/router';

export const OPERATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./operations-list.component').then(m => m.OperationsListComponent)
  }
];
