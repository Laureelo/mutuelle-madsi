import { Component, inject, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MembreService } from '../../services/membre.service';
import { NotificationService, Notif } from '../../services/notification.service';
import { LoginResponse } from '../../models/auth.model';
import { Membre } from '../../models/membre.model';

// Déclaration pour AdminLTE
declare const window: any;

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
  excludeRoles?: string[];
  excludeEtats?: string[];  // Exclure certains états de compte
  divider?: boolean;
  badge?: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-wrapper" [class.sidebar-collapse]="sidebarCollapsed">
      <!-- Header -->
      <nav class="app-header navbar navbar-expand bg-body">
        <div class="container-fluid">
          <!-- Left navbar links -->
          <ul class="navbar-nav">
            <li class="nav-item">
              <a class="nav-link sidebar-toggle" href="javascript:void(0)" role="button" (click)="toggleSidebar()">
                <i class="bi bi-list"></i>
              </a>
            </li>
            <li class="nav-item d-none d-md-block">
              <a [routerLink]="['/dashboard']" class="nav-link">Accueil</a>
            </li>
          </ul>

          <!-- Right navbar links -->
          <ul class="navbar-nav ms-auto">
            <!-- Cloche : notifications dans l'application -->
            <li class="nav-item position-relative" *ngIf="peutVoirNotifications" (click)="$event.stopPropagation()">
              <a href="javascript:void(0)" class="nav-link position-relative" (click)="basculerCloche()" title="Notifications">
                <i class="bi bi-bell-fill"></i>
                <span *ngIf="nonLues > 0" class="badge rounded-pill text-bg-danger position-absolute"
                      style="top: 2px; right: 0; font-size: .65rem;">{{ nonLues > 99 ? '99+' : nonLues }}</span>
              </a>
              <div *ngIf="clocheOuverte" class="card shadow position-absolute end-0 mt-1"
                   style="width: 360px; max-width: 92vw; z-index: 1050; color: #2b3440;">
                <div class="card-header d-flex justify-content-between align-items-center py-2">
                  <strong>Notifications</strong>
                  <a href="javascript:void(0)" class="small" *ngIf="nonLues > 0" (click)="toutLu()">Tout marquer comme lu</a>
                </div>
                <div class="list-group list-group-flush" style="max-height: 420px; overflow-y: auto;">
                  <div *ngIf="notifs.length === 0" class="list-group-item text-muted text-center py-4">
                    <i class="bi bi-bell-slash d-block fs-3 mb-1"></i>Aucune notification
                  </div>
                  <a *ngFor="let n of notifs" href="javascript:void(0)" class="list-group-item list-group-item-action"
                     [class.fw-semibold]="n.etat === 'ENVOYE'" (click)="lire(n)">
                    <div class="d-flex justify-content-between">
                      <span>
                        <i class="bi me-1" [class.bi-exclamation-triangle-fill]="n.type === 'ALERTE'" [class.text-danger]="n.type === 'ALERTE'"
                           [class.bi-info-circle]="n.type !== 'ALERTE'" [class.text-info]="n.type !== 'ALERTE'"></i>{{ n.sujet }}
                      </span>
                      <span *ngIf="n.etat === 'ENVOYE'" class="badge text-bg-primary align-self-start">nouveau</span>
                    </div>
                    <div class="small text-muted" style="white-space: pre-line;">{{ n.messageRendu }}</div>
                    <div class="small text-muted text-end">{{ n.dateEnvoi | date:'dd/MM/yyyy HH:mm' }}</div>
                  </a>
                </div>
              </div>
            </li>

            <!-- User Info -->
            <li class="nav-item">
              <span class="nav-link">
                <i class="bi bi-person-circle me-1"></i>
                <span class="d-none d-md-inline">{{ currentUser?.username }}</span>
              </span>
            </li>

            <!-- Logout Button -->
            <li class="nav-item">
              <a href="javascript:void(0)" (click)="logout()" class="nav-link" title="Déconnexion">
                <i class="bi bi-box-arrow-right"></i>
                <span class="d-none d-md-inline ms-1">Déconnexion</span>
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <!-- Main Sidebar Container -->
      <aside class="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
        <!-- Brand Logo -->
        <div class="sidebar-brand">
          <a [routerLink]="['/dashboard']" class="brand-link">
            <img src="/logo-madsi.jpeg" alt="MADSI Mutuelle" class="brand-image" />
          </a>
        </div>

        <!-- Sidebar -->
        <div class="sidebar-wrapper">
          <nav class="mt-2">
            <ul class="nav sidebar-menu flex-column" data-lte-toggle="treeview" role="menu" data-accordion="false">
              <ng-container *ngFor="let item of visibleMenuItems">
                <!-- Divider -->
                <li *ngIf="item.divider" class="nav-header">{{ item.label }}</li>

                <!-- Menu item -->
                <li *ngIf="!item.divider" class="nav-item">
                  <a [routerLink]="item.route" routerLinkActive="active" class="nav-link">
                    <i [class]="'nav-icon bi ' + item.icon"></i>
                    <p>
                      {{ item.label }}
                      <span *ngIf="item.badge" class="badge text-bg-danger">{{ item.badge }}</span>
                    </p>
                  </a>
                </li>
              </ng-container>
            </ul>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="app-main">
        <router-outlet />
      </main>

      <!-- Téléphone : voile derrière le menu ouvert, un appui le referme -->
      <div class="sidebar-overlay" (click)="fermerMenuMobile()"></div>

      <!-- Footer -->
      <!-- <footer class="app-footer">
        <div class="float-end d-none d-sm-inline">Version 1.0.0</div>
        <strong>Copyright &copy; 2024 <a href="javascript:void(0)">MADSI</a>.</strong> Tous droits réservés.
      </footer> -->
    </div>
  `,
  styles: [`
    /* Custom styles for AdminLTE integration */
    .user-header {
      padding: 20px;
      text-align: center;
    }

    .user-header i {
      display: block;
      margin: 0 auto 10px;
    }

    .user-footer {
      background-color: #f8f9fa;
      padding: 10px;
    }

    /* Header customization with MADSI colors */
    .app-header {
      background: linear-gradient(135deg, #3d9fa8 0%, #3d9fa8 100%) !important;
      border-bottom: 3px solid #e89a3c;
    }

    .app-header .nav-link {
      color: white !important;
    }

    .app-header .nav-link:hover {
      color: #e89a3c !important;
    }

    /* Sidebar customization */
    .app-sidebar {
      background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%) !important;
      display: flex;
      flex-direction: column;
      height: 100vh;
      top: 0;
      z-index: 1038;
    }

    .sidebar-wrapper {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .sidebar-wrapper::-webkit-scrollbar {
      width: 6px;
    }

    .sidebar-wrapper::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
    }

    .sidebar-wrapper::-webkit-scrollbar-thumb {
      background: rgba(61, 159, 168, 0.5);
      border-radius: 3px;
    }

    .sidebar-wrapper::-webkit-scrollbar-thumb:hover {
      background: rgba(61, 159, 168, 0.8);
    }

    .sidebar-brand {
      background-color: rgba(255, 255, 255, 0.05);
      border-bottom: 2px solid #3d9fa8;
      flex-shrink: 0;
    }

    .brand-link {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem 0.5rem;
      text-decoration: none;
    }

    .brand-image {
      width: 120px;
      height: auto;
      max-width: 100%;
    }

    /* Navigation active state customization */
    .nav-link.active {
      background-color: rgba(61, 159, 168, 0.3) !important;
      border-left: 3px solid #3d9fa8;
    }

    .sidebar-menu .nav-link:hover {
      background-color: rgba(61, 159, 168, 0.2) !important;
    }

    .nav-header {
      color: #e89a3c !important;
      font-weight: 600;
    }

    /* Sidebar toggle button */
    .sidebar-toggle {
      cursor: pointer;
      font-size: 1.25rem;
    }

    .sidebar-toggle:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    /* Sidebar collapse state */
    :host ::ng-deep .sidebar-collapse .app-sidebar {
      margin-left: -250px;
      transition: margin-left 0.3s ease-in-out;
    }

    :host ::ng-deep .sidebar-collapse .app-main {
      margin-left: 0 !important;
      transition: margin-left 0.3s ease-in-out;
    }

    :host ::ng-deep .sidebar-collapse .app-footer {
      margin-left: 0 !important;
      transition: margin-left 0.3s ease-in-out;
    }

    :host ::ng-deep .app-sidebar {
      transition: margin-left 0.3s ease-in-out;
    }

    :host ::ng-deep .app-main {
      transition: margin-left 0.3s ease-in-out;
    }

    :host ::ng-deep .app-footer {
      transition: margin-left 0.3s ease-in-out;
    }
  `]
})
export class LayoutComponent implements OnDestroy {
  private notificationService = inject(NotificationService);
  nonLues = 0;
  notifs: Notif[] = [];
  clocheOuverte = false;
  private minuteurCloche?: any;

  /** Les visiteurs n'ont pas encore de notifications dans l'application. */
  get peutVoirNotifications(): boolean {
    return !!this.currentUser?.id && !!this.currentUser?.roles?.some(r => r !== 'VISITEUR');
  }

  @HostListener('document:click')
  fermerCloche(): void {
    this.clocheOuverte = false;
  }

  private demarrerCloche(): void {
    if (this.minuteurCloche || !this.peutVoirNotifications) return;
    this.rafraichirCompteur();
    this.minuteurCloche = setInterval(() => this.rafraichirCompteur(), 60000);
  }

  private rafraichirCompteur(): void {
    if (!this.currentUser?.id) return;
    this.notificationService.nonLues(this.currentUser.id).subscribe({
      next: (r) => this.nonLues = r.count,
      error: () => {}
    });
  }

  basculerCloche(): void {
    this.clocheOuverte = !this.clocheOuverte;
    if (this.clocheOuverte && this.currentUser?.id) {
      this.notificationService.liste(this.currentUser.id, 10).subscribe({
        next: (r) => this.notifs = r.content,
        error: () => this.notifs = []
      });
    }
  }

  lire(n: Notif): void {
    if (n.etat !== 'ENVOYE') return;
    this.notificationService.marquerLue(n.id).subscribe({
      next: () => { n.etat = 'LU'; this.nonLues = Math.max(0, this.nonLues - 1); },
      error: () => {}
    });
  }

  toutLu(): void {
    if (!this.currentUser?.id) return;
    this.notificationService.toutMarquerLu(this.currentUser.id).subscribe({
      next: () => { this.notifs.forEach(n => n.etat = 'LU'); this.nonLues = 0; },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    if (this.minuteurCloche) clearInterval(this.minuteurCloche);
    this.fermerMenuMobile();
    this.observateurTableaux?.disconnect();
  }

  private authService = inject(AuthService);
  private membreService = inject(MembreService);
  private router = inject(Router);

  currentUser: LoginResponse | null = null;
  currentMembre: Membre | null = null;
  sidebarCollapsed = false;

  // Menu par rôle. Hiérarchie : VISITEUR < MEMBRE < TRESORIER / COMMISSAIRE < ADMIN (le « bureau » = président et trésoriers)
  // (les rôles reçus à la connexion sont les rôles EFFECTIFS : un compte pas encore activé est VISITEUR)
  menuItems: MenuItem[] = [
    // GÉNÉRAL (tous les comptes connectés)
    { label: 'Tableau de bord', icon: 'bi-speedometer2', route: '/dashboard' },
    { label: 'Mon Profil', icon: 'bi-person-gear', route: '/profil' },
    { label: 'Mon Adhésion', icon: 'bi-cash-coin', route: '/adhesion', roles: ['VISITEUR'] },

    // GESTION
    { label: 'GESTION', icon: '', route: '', divider: true, roles: ['ADMIN', 'TRESORIER'] },
    { label: 'Membres', icon: 'bi-people', route: '/membres', roles: ['ADMIN', 'TRESORIER'] },
    { label: 'Adhésions', icon: 'bi-cash-stack', route: '/adhesion/tresorier', roles: ['TRESORIER', 'ADMIN'] },

    // FINANCES (comptes actifs uniquement)
    { label: 'FINANCES', icon: '', route: '', divider: true, roles: ['MEMBRE', 'TRESORIER', 'COMMISSAIRE', 'ADMIN'] },
    { label: 'Cotisations', icon: 'bi-cash-stack', route: '/cotisations', roles: ['MEMBRE', 'TRESORIER', 'COMMISSAIRE', 'ADMIN'] },
    { label: 'Prêts', icon: 'bi-credit-card', route: '/prets', roles: ['MEMBRE', 'TRESORIER', 'COMMISSAIRE', 'ADMIN'] },
    { label: 'Opérations', icon: 'bi-arrow-left-right', route: '/operations', roles: ['TRESORIER', 'COMMISSAIRE', 'ADMIN'] },

    // ACTIVITÉS
    { label: 'ACTIVITÉS', icon: '', route: '', divider: true, roles: ['MEMBRE', 'TRESORIER', 'COMMISSAIRE', 'ADMIN'] },
    { label: 'Manifestations', icon: 'bi-calendar-event', route: '/manifestations', roles: ['MEMBRE', 'TRESORIER', 'COMMISSAIRE', 'ADMIN'] },
    { label: 'Types d\'activité', icon: 'bi-tag', route: '/types-activite', roles: ['ADMIN'] },

    // COMMUNICATION (trésorier, administrateur)
    { label: 'COMMUNICATION', icon: '', route: '', divider: true, roles: ['TRESORIER', 'ADMIN'] },
    { label: 'Relances cotisations', icon: 'bi-megaphone', route: '/relances', roles: ['TRESORIER', 'ADMIN'] },
    { label: 'Informer les membres', icon: 'bi-chat-square-text', route: '/annonces', roles: ['TRESORIER', 'ADMIN'] },

    // ANALYSE (trésorerie en lecture : trésorier, commissaire, admin)
    { label: 'ANALYSE', icon: '', route: '', divider: true, roles: ['TRESORIER', 'COMMISSAIRE', 'ADMIN'] },
    { label: 'Tableaux de bord', icon: 'bi-pie-chart', route: '/stats', roles: ['TRESORIER', 'COMMISSAIRE', 'ADMIN'] },
    { label: 'Rapports', icon: 'bi-file-earmark-bar-graph', route: '/rapports', roles: ['TRESORIER', 'COMMISSAIRE', 'ADMIN'] },

    // ADMINISTRATION
    { label: 'ADMINISTRATION', icon: '', route: '', divider: true, roles: ['ADMIN'] },
    { label: 'Paramètres', icon: 'bi-gear', route: '/parametres', roles: ['ADMIN'] },
    { label: 'Santé du système', icon: 'bi-heart-pulse', route: '/sante', roles: ['ADMIN'] }
  ];

  constructor() {
    // Téléphone : le menu se referme dès qu'on a choisi une page
    this.router.events.subscribe(e => { if (e instanceof NavigationEnd) this.fermerMenuMobile(); });
    this.etiqueterTableaux();
    // Relit le rôle et l'état du compte auprès du serveur (activation, changement de rôle...)
    this.authService.refreshSession().subscribe({ error: () => {} });
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user?.id) {
        this.loadCurrentMembre();
        this.demarrerCloche();
      }
    });
  }

  loadCurrentMembre(): void {
    if (this.currentUser?.id) {
      this.membreService.getById(this.currentUser.id).subscribe({
        next: (membre) => {
          this.currentMembre = membre;
        },
        error: (err) => {
          console.error('Erreur chargement membre:', err);
        }
      });
    }
  }

  get visibleMenuItems(): MenuItem[] {
    if (!this.currentUser?.roles) {
      return this.menuItems.filter(item => !item.roles && !item.excludeRoles && !item.excludeEtats);
    }

    return this.menuItems.filter(item => {
      // Exclure si l'utilisateur a un état de compte exclu
      if (item.excludeEtats && item.excludeEtats.length > 0 && this.currentMembre?.etatCompte) {
        if (item.excludeEtats.includes(this.currentMembre.etatCompte)) {
          return false;
        }
      }

      // Exclure si l'utilisateur a un des rôles exclus
      if (item.excludeRoles && item.excludeRoles.length > 0) {
        if (item.excludeRoles.some(role => this.currentUser?.roles.includes(role))) {
          return false;
        }
      }

      // Inclure si pas de restriction de rôles
      if (!item.roles || item.roles.length === 0) {
        return true;
      }

      // Inclure si l'utilisateur a un des rôles requis
      return item.roles.some(role => this.currentUser?.roles.includes(role));
    });
  }

  private observateurTableaux?: MutationObserver;

  /**
   * Sur téléphone, chaque ligne de tableau s'affiche comme une petite fiche « intitulé : valeur ».
   * Pour cela, chaque cellule reçoit en attribut le titre de sa colonne (lu dans l'en-tête du tableau).
   */
  private etiqueterTableaux(): void {
    if (typeof document === 'undefined') return;
    let planifie = false;
    const annoter = () => {
      planifie = false;
      document.querySelectorAll('table').forEach(t => {
        const titres = Array.from(t.querySelectorAll('thead th')).map(h => (h.textContent || '').trim());
        if (!titres.length) return;
        t.querySelectorAll('tbody tr').forEach(tr => {
          Array.from(tr.children).forEach((td, i) => {
            if (td.tagName === 'TD' && !td.hasAttribute('data-label') && !td.hasAttribute('colspan') && titres[i]) {
              td.setAttribute('data-label', titres[i]);
            }
          });
        });
      });
    };
    this.observateurTableaux = new MutationObserver(() => {
      if (!planifie) { planifie = true; requestAnimationFrame(annoter); }
    });
    this.observateurTableaux.observe(document.body, { childList: true, subtree: true });
  }

  /** Sur téléphone et tablette étroite, le menu s'ouvre par-dessus la page (classe « sidebar-open » sur <body>, gérée par AdminLTE). */
  private get estMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 992;
  }

  toggleSidebar(): void {
    if (this.estMobile) {
      document.body.classList.toggle('sidebar-open');
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
  }

  fermerMenuMobile(): void {
    document.body.classList.remove('sidebar-open');
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
