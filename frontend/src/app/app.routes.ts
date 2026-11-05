import { Routes } from '@angular/router';
import { LoginComponent } from './components/auth/login.component';
import { RegisterComponent } from './components/auth/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LayoutComponent } from './components/layout/layout.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard, ROLES_ACTIFS, ROLES_FINANCES, ROLES_MEMBRES } from './guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'mot-de-passe-oublie', loadComponent: () => import('./components/auth/mot-de-passe-oublie.component').then(m => m.MotDePasseOublieComponent) },
  { path: 'reinitialiser-mot-de-passe', loadComponent: () => import('./components/auth/reinitialiser-mot-de-passe.component').then(m => m.ReinitialiserMotDePasseComponent) },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'profil', loadChildren: () => import('./components/profil/profil.routes').then(m => m.PROFIL_ROUTES) },
      { path: 'adhesion', loadChildren: () => import('./components/adhesion/adhesions.routes').then(m => m.ADHESIONS_ROUTES) },
      { path: 'membres', canActivate: [roleGuard(...ROLES_MEMBRES)], loadChildren: () => import('./components/membres/membres.routes').then(m => m.MEMBRES_ROUTES) },
      { path: 'cotisations', canActivate: [roleGuard(...ROLES_ACTIFS)], loadChildren: () => import('./components/cotisations/cotisations.routes').then(m => m.COTISATIONS_ROUTES) },
      { path: 'prets', canActivate: [roleGuard(...ROLES_ACTIFS)], loadChildren: () => import('./components/prets/prets.routes').then(m => m.PRETS_ROUTES) },
      { path: 'operations', canActivate: [roleGuard(...ROLES_FINANCES)], loadChildren: () => import('./components/operations/operations.routes').then(m => m.OPERATIONS_ROUTES) },
      { path: 'manifestations', canActivate: [roleGuard(...ROLES_ACTIFS)], loadChildren: () => import('./components/manifestations/manifestations.routes').then(m => m.MANIFESTATIONS_ROUTES) },
      { path: 'types-activite', canActivate: [roleGuard('ADMIN')], loadChildren: () => import('./components/types-activite/types-activite.routes').then(m => m.TYPES_ACTIVITE_ROUTES) },
      { path: 'rapports', canActivate: [roleGuard(...ROLES_FINANCES)], loadChildren: () => import('./components/rapports/rapports.routes').then(m => m.RAPPORTS_ROUTES) },
      { path: 'parametres', canActivate: [roleGuard('ADMIN')], loadChildren: () => import('./components/parametres/parametres.routes').then(m => m.PARAMETRES_ROUTES) },
      // NOUVELLES ROUTES
      { path: 'relances', canActivate: [roleGuard('TRESORIER', 'ADMIN')], loadComponent: () => import('./components/cotisations/relances.component').then(m => m.RelancesComponent) },
      { path: 'annonces', canActivate: [roleGuard('TRESORIER', 'ADMIN')], loadComponent: () => import('./components/annonces/annonces.component').then(m => m.AnnoncesComponent) },
      { path: 'sante', canActivate: [roleGuard('ADMIN')], loadChildren: () => import('./components/sante/sante.routes').then(m => m.SANTE_ROUTES) },
      { path: 'stats', canActivate: [roleGuard(...ROLES_FINANCES)], loadChildren: () => import('./components/stats/stats.routes').then(m => m.STATS_ROUTES) },
    ]
  },
  { path: '**', redirectTo: '/login' }
];
