import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MembreService } from '../../services/membre.service';
import { AuthService } from '../../services/auth.service';
import { StatsService, MembershipStats } from '../../services/stats.service';
import { Membre, EtatCompte, RoleMembre } from '../../models/membre.model';
import { PageResponse } from '../../models/common.model';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-membres-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <!-- Content Header -->
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-6">
            <h3 class="mb-0">Gestion des Membres</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end">
              <li class="breadcrumb-item"><a href="#" [routerLink]="['/dashboard']">Accueil</a></li>
              <li class="breadcrumb-item active" aria-current="page">Membres</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="app-content">
      <div class="container-fluid">
        <!-- Cartes Résumé -->
        <div class="row mb-4">
          <div class="col-12 col-sm-6 col-md-3">
            <div class="info-box">
              <span class="info-box-icon text-bg-info shadow-sm">
                <i class="bi bi-people-fill"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">Total Membres</span>
                <span class="info-box-number">{{ membershipStats?.totalMembres || 0 }}</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <div class="info-box">
              <span class="info-box-icon text-bg-success shadow-sm">
                <i class="bi bi-person-check-fill"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">Membres Actifs</span>
                <span class="info-box-number">{{ membershipStats?.membresActifs || 0 }}</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <div class="info-box">
              <span class="info-box-icon text-bg-warning shadow-sm">
                <i class="bi bi-hourglass-split"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">En Attente</span>
                <span class="info-box-number">{{ membershipStats?.membresEnAttente || 0 }}</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <div class="info-box">
              <span class="info-box-icon text-bg-secondary shadow-sm">
                <i class="bi bi-person-dash-fill"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">Inactifs</span>
                <span class="info-box-number">{{ membershipStats?.membresInactifs || 0 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Filters Card -->
        <div class="card mb-4">
          <div class="card-header">
            <h3 class="card-title">
              <i class="bi bi-funnel me-2"></i>Filtres
            </h3>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Rechercher..."
                    [(ngModel)]="searchTerm"
                    (input)="onSearchChange()"
                  />
                </div>
              </div>
              <div class="col-md-4">
                <select class="form-select" [(ngModel)]="selectedEtat" (change)="onFilterChange()">
                  <option value="">Tous les états</option>
                  <option value="VISITEUR">Visiteur</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="VALIDE_PAR_TRESORERIE">Validé par trésorerie</option>
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                </select>
              </div>
              <div class="col-md-4">
                <select class="form-select" [(ngModel)]="selectedRole" (change)="onFilterChange()">
                  <option value="">Tous les rôles</option>
                  <option value="VISITEUR">Visiteur</option>
                  <option value="MEMBRE">Membre</option>
                  <option value="TRESORIER">Trésorier</option>
                  <option value="COMMISSAIRE">Commissaire aux comptes</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Members Table Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Liste des Membres</h3>
            <div class="card-tools">
              <button *ngIf="isAdmin" class="btn btn-primary btn-sm" [routerLink]="['nouveau']">
                <i class="bi bi-plus-circle me-1"></i> Nouveau Membre
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div *ngIf="loading" class="card-body text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3">Chargement des membres...</p>
          </div>

          <!-- Error State -->
          <div *ngIf="error" class="card-body text-center py-5">
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
            </div>
            <button class="btn btn-secondary" (click)="loadMembres()">
              <i class="bi bi-arrow-clockwise me-1"></i>Réessayer
            </button>
          </div>

          <!-- Table -->
          <div *ngIf="!loading && !error" class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-striped table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom Complet</th>
                    <th>Email</th>
                    <th>Téléphone</th>
                    <th>Rôle</th>
                    <th>État</th>
                    <th>Date Inscription</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let membre of membres">
                    <td><span class="badge text-bg-secondary">{{ membre.matricule || '-' }}</span></td>
                    <td>
                      <strong>{{ membre.firstName }} {{ membre.lastName }}</strong>
                      <br>
                      <small class="text-muted">{{ membre.username }}</small>
                    </td>
                    <td>{{ membre.email }}</td>
                    <td>{{ membre.phone || '-' }}</td>
                    <td>
                      <span class="badge text-bg-primary">
                        {{ getRoleLabel(membre.role) }}
                      </span>
                    </td>
                    <td>
                      <span class="badge"
                        [class.text-bg-success]="membre.etatCompte === 'ACTIF'"
                        [class.text-bg-warning]="membre.etatCompte === 'EN_ATTENTE' || membre.etatCompte === 'VALIDE_PAR_TRESORERIE'"
                        [class.text-bg-secondary]="membre.etatCompte === 'VISITEUR'"
                        [class.text-bg-danger]="membre.etatCompte === 'INACTIF'">
                        {{ getEtatLabel(membre.etatCompte) }}
                      </span>
                    </td>
                    <td>{{ formatDate(membre.dateRegistered) }}</td>
                    <td>
                      <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" [routerLink]="[membre.id]" title="Voir détails">
                          <i class="bi bi-eye"></i>
                        </button>
                        <!-- Modifier : Admin uniquement -->
                        <button
                          *ngIf="isAdmin"
                          class="btn btn-outline-secondary"
                          [routerLink]="[membre.id, 'edit']"
                          title="Modifier">
                          <i class="bi bi-pencil"></i>
                        </button>
                        <!-- Validation par trésorerie : Trésoriers et Admins -->
                        <button
                          *ngIf="(isTresorier || isAdmin) && membre.etatCompte === 'EN_ATTENTE'"
                          class="btn btn-outline-info"
                          (click)="validerParTresorerie(membre)"
                          title="Valider par trésorerie">
                          <i class="bi bi-check-circle"></i>
                        </button>
                        <!-- Activation : Admin uniquement -->
                        <button
                          *ngIf="isAdmin && membre.etatCompte === 'VALIDE_PAR_TRESORERIE'"
                          class="btn btn-outline-success"
                          (click)="validateMembre(membre)"
                          title="Activer">
                          <i class="bi bi-check2"></i>
                        </button>
                        <!-- Désactivation : Admin uniquement -->
                        <button
                          *ngIf="isAdmin && membre.etatCompte === 'ACTIF'"
                          class="btn btn-outline-warning"
                          (click)="deactivateMembre(membre)"
                          title="Désactiver">
                          <i class="bi bi-pause-circle"></i>
                        </button>
                        <!-- Suppression : Admin uniquement -->
                        <button
                          *ngIf="isAdmin"
                          class="btn btn-outline-danger"
                          (click)="deleteMembre(membre)"
                          title="Supprimer">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr *ngIf="membres.length === 0">
                    <td colspan="9" class="text-center py-4">
                      <i class="bi bi-inbox display-4 text-muted"></i>
                      <p class="text-muted mt-2">Aucun membre trouvé</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div *ngIf="!loading && !error && totalPages > 1" class="card-footer clearfix">
            <ul class="pagination pagination-sm m-0 float-end">
              <li class="page-item" [class.disabled]="currentPage === 0">
                <a class="page-link" href="javascript:void(0)" (click)="goToPage(currentPage - 1)">«</a>
              </li>
              <li class="page-item active">
                <span class="page-link">Page {{ currentPage + 1 }} / {{ totalPages }}</span>
              </li>
              <li class="page-item" [class.disabled]="currentPage === totalPages - 1">
                <a class="page-link" href="javascript:void(0)" (click)="goToPage(currentPage + 1)">»</a>
              </li>
            </ul>
            <div class="float-start pt-2">
              <small class="text-muted">Total: {{ totalElements }} membres</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .info-box {
      box-shadow: 0 0 1px rgba(0,0,0,.125), 0 1px 3px rgba(0,0,0,.2);
      border-radius: .25rem;
      background-color: #fff;
      display: flex;
      margin-bottom: 1rem;
      min-height: 80px;
      padding: .5rem;
      position: relative;
      width: 100%;
    }
    .info-box-icon {
      border-radius: .25rem;
      align-items: center;
      display: flex;
      font-size: 1.875rem;
      justify-content: center;
      text-align: center;
      width: 70px;
    }
    .info-box-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      line-height: 1.8;
      flex: 1;
      padding: 0 10px;
      overflow: hidden;
    }
    .info-box-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .info-box-number {
      display: block;
      margin-top: .25rem;
      font-weight: 700;
    }
  `]
})
export class MembresListComponent implements OnInit {
  private dialog = inject(DialogService);
  private membreService = inject(MembreService);
  private authService = inject(AuthService);
  private statsService = inject(StatsService);

  membres: Membre[] = [];
  membershipStats: MembershipStats | null = null;
  loading = false;
  error = '';
  currentUser: any = null;

  searchTerm = '';
  selectedEtat = '';
  selectedRole = '';

  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMembres();
    this.loadStats();
  }

  loadStats(): void {
    const currentYear = new Date().getFullYear();
    console.log('=== Chargement stats membership pour année:', currentYear);
    this.statsService.getMembershipStats(currentYear).subscribe({
      next: (stats) => {
        console.log('=== Stats reçues:', JSON.stringify(stats));
        this.membershipStats = stats;
      },
      error: (err) => {
        console.error('Erreur chargement stats:', err);
      }
    });
  }

  // Vérifier si l'utilisateur est trésorier
  get isTresorier(): boolean {
    return this.currentUser?.roles?.includes('TRESORIER') || false;
  }

  // Vérifier si l'utilisateur est admin
  get isAdmin(): boolean {
    return this.currentUser?.roles?.includes('ADMIN') || false;
  }

  loadMembres(): void {
    this.loading = true;
    this.error = '';

    // Convertir les strings en enums pour le filtre
    const etatCompteFilter = this.selectedEtat ? (this.selectedEtat as EtatCompte) : undefined;
    const roleFilter = this.selectedRole ? (this.selectedRole as RoleMembre) : undefined;

    // Utiliser les filtres backend directement
    this.membreService.getAll({
      search: this.searchTerm || undefined,
      etatCompte: etatCompteFilter,
      role: roleFilter,
      page: this.currentPage,
      size: this.pageSize
    }).subscribe({
      next: (response: PageResponse<Membre>) => {
        this.membres = response.content;
        this.totalPages = response.totalPages;
        this.totalElements = response.totalElements;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des membres: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.currentPage = 0;
    this.loadMembres();
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadMembres();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadMembres();
  }

  /**
   * Validation par la trésorerie : passe de EN_ATTENTE à VALIDE_PAR_TRESORERIE
   */
  async validerParTresorerie(membre: Membre): Promise<void> {
    if (await this.dialog.confirm({ titre: 'Confirmation', message: `Voulez-vous valider ce membre par la trésorerie ?\n${membre.firstName} ${membre.lastName}` })) {
      // Utiliser l'ID 1 comme trésorier par défaut (devrait venir du token JWT)
      this.membreService.validerParTresorerie(membre.id, 1).subscribe({
        next: () => {
          this.loadMembres();
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de la validation par trésorerie: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  /**
   * Activation par l'administrateur métier : passe de VALIDE_PAR_TRESORERIE à ACTIF
   */
  async validateMembre(membre: Membre): Promise<void> {
    if (await this.dialog.confirm({ titre: 'Confirmation', message: `Voulez-vous activer le compte de ce membre ?\n${membre.firstName} ${membre.lastName}` })) {
      // Utiliser l'ID 1 comme validateur par défaut (devrait venir du token JWT)
      this.membreService.validateMembre(membre.id, 1).subscribe({
        next: () => {
          this.loadMembres();
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de l\'activation: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async deactivateMembre(membre: Membre): Promise<void> {
    if (await this.dialog.confirm({ titre: 'Désactiver ?', message: `Voulez-vous désactiver le membre ${membre.firstName} ${membre.lastName} ?`, danger: true, confirmer: 'Désactiver' })) {
      // Utiliser l'ID 1 comme admin par défaut (devrait venir du token JWT)
      this.membreService.deactivateMembre(membre.id, 1).subscribe({
        next: () => {
          this.loadMembres();
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de la désactivation: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async deleteMembre(membre: Membre): Promise<void> {
    if (await this.dialog.confirm({ titre: 'Supprimer ?', message: `Voulez-vous vraiment supprimer le membre ${membre.firstName} ${membre.lastName} ? Cette action est irréversible.`, danger: true, confirmer: 'Supprimer' })) {
      this.membreService.delete(membre.id).subscribe({
        next: () => {
          this.loadMembres();
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de la suppression: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  getRoleLabel(role: RoleMembre): string {
    const labels: Record<RoleMembre, string> = {
      [RoleMembre.VISITEUR]: 'Visiteur',
      [RoleMembre.MEMBRE]: 'Membre',
      [RoleMembre.TRESORIER]: 'Trésorier',
      [RoleMembre.COMMISSAIRE]: 'Commissaire aux comptes',
      [RoleMembre.ADMIN]: 'Administrateur'
    };
    return labels[role] || role;
  }

  getEtatLabel(etat: EtatCompte): string {
    const labels: Record<EtatCompte, string> = {
      [EtatCompte.VISITEUR]: 'Visiteur',
      [EtatCompte.EN_ATTENTE]: 'En attente',
      [EtatCompte.VALIDE_PAR_TRESORERIE]: 'Validé par trésorerie',
      [EtatCompte.ACTIF]: 'Actif',
      [EtatCompte.INACTIF]: 'Inactif'
    };
    return labels[etat] || etat;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }
}
