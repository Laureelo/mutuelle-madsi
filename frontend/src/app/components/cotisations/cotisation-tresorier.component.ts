import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CotisationService } from '../../services/cotisation.service';
import { AuthService } from '../../services/auth.service';
import { Cotisation, CotisationStats } from '../../models/cotisation.model';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-cotisation-tresorier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row align-items-center">
          <div class="col-sm-6">
            <h3 class="mb-0"><i class="bi bi-wallet2 me-2"></i>Gestion des Cotisations</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end mb-0">
              <li class="breadcrumb-item"><a href="#" (click)="$event.preventDefault()">Accueil</a></li>
              <li class="breadcrumb-item active">Cotisations</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <!-- Statistiques -->
        <div class="row g-3 mb-4" *ngIf="stats">
          <div class="col-xl-3 col-md-6">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-shrink-0">
                    <div class="bg-warning bg-opacity-10 rounded-circle p-3">
                      <i class="bi bi-hourglass-split text-warning fs-4"></i>
                    </div>
                  </div>
                  <div class="flex-grow-1 ms-3">
                    <h3 class="mb-0 fw-bold">{{ stats.enAttente }}</h3>
                    <p class="text-muted mb-0 small">En attente</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-xl-3 col-md-6">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-shrink-0">
                    <div class="bg-success bg-opacity-10 rounded-circle p-3">
                      <i class="bi bi-check-circle text-success fs-4"></i>
                    </div>
                  </div>
                  <div class="flex-grow-1 ms-3">
                    <h3 class="mb-0 fw-bold">{{ stats.payees }}</h3>
                    <p class="text-muted mb-0 small">Validées</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-xl-3 col-md-6">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-shrink-0">
                    <div class="bg-danger bg-opacity-10 rounded-circle p-3">
                      <i class="bi bi-exclamation-circle text-danger fs-4"></i>
                    </div>
                  </div>
                  <div class="flex-grow-1 ms-3">
                    <h3 class="mb-0 fw-bold">{{ stats.enRetard }}</h3>
                    <p class="text-muted mb-0 small">En retard</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-xl-3 col-md-6">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-body">
                <div class="d-flex align-items-center">
                  <div class="flex-shrink-0">
                    <div class="bg-primary bg-opacity-10 rounded-circle p-3">
                      <i class="bi bi-cash-stack text-primary fs-4"></i>
                    </div>
                  </div>
                  <div class="flex-grow-1 ms-3">
                    <h3 class="mb-0 fw-bold">{{ stats.montantTotal | number:'1.0-0' }}</h3>
                    <p class="text-muted mb-0 small">Total (FCFA)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div class="alert alert-success alert-dismissible fade show" *ngIf="successMessage">
          <i class="bi bi-check-circle me-2"></i>{{ successMessage }}
          <button type="button" class="btn-close" (click)="successMessage = ''" aria-label="Close"></button>
        </div>

        <div class="alert alert-danger alert-dismissible fade show" *ngIf="errorMessage">
          <i class="bi bi-exclamation-triangle me-2"></i>{{ errorMessage }}
          <button type="button" class="btn-close" (click)="errorMessage = ''" aria-label="Close"></button>
        </div>

        <!-- Carte principale -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white py-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h5 class="card-title mb-0">
                <i class="bi bi-list-check me-2"></i>Liste des cotisations
              </h5>
              <!-- Onglets -->
              <ul class="nav nav-pills" role="tablist">
                <li class="nav-item" role="presentation">
                  <button
                    class="nav-link py-1 px-3"
                    [class.active]="activeTab === 'attente'"
                    (click)="activeTab = 'attente'; loadCotisations()"
                    type="button">
                    En attente
                    <span class="badge bg-warning text-dark ms-1" *ngIf="stats && stats.enAttente > 0">{{ stats.enAttente }}</span>
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button
                    class="nav-link py-1 px-3"
                    [class.active]="activeTab === 'toutes'"
                    (click)="activeTab = 'toutes'; loadCotisations()"
                    type="button">
                    Toutes
                    <span class="badge bg-secondary ms-1" *ngIf="stats">{{ stats.total }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="card-body p-0">
            <!-- Loading -->
            <div *ngIf="loading" class="text-center py-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement...</span>
              </div>
              <p class="text-muted mt-2 mb-0">Chargement des cotisations...</p>
            </div>

            <!-- Liste des cotisations -->
            <div class="table-responsive" *ngIf="!loading">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="ps-3">Membre</th>
                    <th>Période(s)</th>
                    <th class="text-center">Mois</th>
                    <th class="text-end">Montant</th>
                    <th>Paiement</th>
                    <th class="text-center">Statut</th>
                    <th class="text-center pe-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let cotisation of cotisations" class="cotisation-row">
                    <td class="ps-3">
                      <div class="d-flex align-items-center">
                        <div class="avatar-circle bg-primary bg-opacity-10 text-primary me-2">
                          {{ getInitials(cotisation.membreNom) }}
                        </div>
                        <div>
                          <div class="fw-semibold">{{ cotisation.membreNom || 'Membre #' + cotisation.membreId }}</div>
                          <small class="text-muted" *ngIf="cotisation.membreEmail">{{ cotisation.membreEmail }}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="fw-medium">{{ formatPeriodes(cotisation.periodes) }}</div>
                      <small class="text-muted" *ngIf="cotisation.remarque">
                        <i class="bi bi-chat-left-text me-1"></i>{{ cotisation.remarque }}
                      </small>
                    </td>
                    <td class="text-center">
                      <span class="badge bg-light text-dark">{{ cotisation.nombreMois }} mois</span>
                    </td>
                    <td class="text-end">
                      <span class="fw-bold text-success">{{ cotisation.montant | number:'1.0-0' }} FCFA</span>
                    </td>
                    <td>
                      <div class="small">
                        <div><i class="bi bi-credit-card me-1"></i>{{ formatModePaiement(cotisation.modePaiement) }}</div>
                        <div class="text-muted" *ngIf="cotisation.reference">Réf: {{ cotisation.reference }}</div>
                        <div class="text-muted">{{ cotisation.datePaiement | date:'dd/MM/yyyy' }}</div>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="badge rounded-pill"
                            [class.bg-warning]="cotisation.statut === 'EN_ATTENTE'"
                            [class.text-dark]="cotisation.statut === 'EN_ATTENTE'"
                            [class.bg-success]="cotisation.statut === 'PAYE'"
                            [class.bg-danger]="cotisation.statut === 'EN_RETARD'"
                            [class.bg-info]="cotisation.statut === 'PARTIEL'">
                        <i class="bi me-1"
                           [class.bi-hourglass-split]="cotisation.statut === 'EN_ATTENTE'"
                           [class.bi-check-circle]="cotisation.statut === 'PAYE'"
                           [class.bi-exclamation-circle]="cotisation.statut === 'EN_RETARD'"
                           [class.bi-pie-chart]="cotisation.statut === 'PARTIEL'"></i>
                        {{ getStatutLabel(cotisation.statut) }}
                      </span>
                    </td>
                    <td class="text-center pe-3">
                      <div class="btn-group" *ngIf="cotisation.statut === 'EN_ATTENTE'">
                        <button
                          class="btn btn-sm btn-outline-success"
                          (click)="valider(cotisation)"
                          title="Valider ce paiement">
                          <i class="bi bi-check-lg"></i>
                        </button>
                        <button
                          class="btn btn-sm btn-outline-danger"
                          (click)="showRejetModal(cotisation)"
                          title="Rejeter ce paiement">
                          <i class="bi bi-x-lg"></i>
                        </button>
                      </div>
                      <!-- Voir : pour admin (toutes) ou trésorier (déjà traitées) -->
                      <button
                        *ngIf="cotisation.statut !== 'EN_ATTENTE'"
                        class="btn btn-sm btn-outline-secondary"
                        (click)="showDetails(cotisation)"
                        title="Voir les détails">
                        <i class="bi bi-eye"></i>
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="cotisations.length === 0">
                    <td colspan="7" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                        <p class="mb-0">Aucune cotisation {{ activeTab === 'attente' ? 'en attente de validation' : 'enregistrée' }}</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal de rejet -->
        <div class="modal fade" [class.show]="showRejetModalFlag" [style.display]="showRejetModalFlag ? 'block' : 'none'" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 shadow">
              <div class="modal-header border-0 bg-danger bg-opacity-10">
                <h5 class="modal-title text-danger">
                  <i class="bi bi-x-circle me-2"></i>Rejeter la cotisation
                </h5>
                <button type="button" class="btn-close" (click)="closeRejetModal()"></button>
              </div>
              <div class="modal-body">
                <p class="text-muted">Veuillez indiquer le motif du rejet. Le membre sera notifié et pourra soumettre un nouveau paiement.</p>
                <div class="mb-3">
                  <label for="motifRejet" class="form-label fw-semibold">Motif du rejet <span class="text-danger">*</span></label>
                  <textarea
                    id="motifRejet"
                    class="form-control"
                    [(ngModel)]="motifRejet"
                    rows="3"
                    placeholder="Ex: Référence de transaction invalide, montant incorrect..."></textarea>
                </div>
              </div>
              <div class="modal-footer border-0">
                <button type="button" class="btn btn-light" (click)="closeRejetModal()">Annuler</button>
                <button
                  type="button"
                  class="btn btn-danger"
                  (click)="confirmRejet()"
                  [disabled]="!motifRejet || motifRejet.trim() === ''">
                  <i class="bi bi-x-circle me-1"></i>Confirmer le rejet
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop fade" [class.show]="showRejetModalFlag" *ngIf="showRejetModalFlag"></div>
      </div>
    </div>
  `,
  styles: [`
    .modal.show { display: block; }
    .modal-backdrop.show { opacity: 0.5; }
    .avatar-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .cotisation-row:hover {
      background-color: rgba(0,0,0,0.02);
    }
    .nav-pills .nav-link {
      color: #6c757d;
      font-size: 0.875rem;
    }
    .nav-pills .nav-link.active {
      background-color: #0d6efd;
    }
  `]
})
export class CotisationTresorierComponent implements OnInit {
  private dialog = inject(DialogService);
  private cotisationService = inject(CotisationService);
  private authService = inject(AuthService);

  cotisations: Cotisation[] = [];
  stats: CotisationStats | null = null;
  loading = false;
  successMessage = '';
  errorMessage = '';
  activeTab: 'attente' | 'toutes' = 'attente';

  // Modal rejet
  showRejetModalFlag = false;
  selectedCotisation: Cotisation | null = null;
  motifRejet = '';

  ngOnInit(): void {
    this.loadStats();
    this.loadCotisations();
  }

  loadStats(): void {
    this.cotisationService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (err) => {
        console.error('Erreur chargement stats:', err);
      }
    });
  }

  loadCotisations(): void {
    this.loading = true;
    this.errorMessage = '';

    const observable = this.activeTab === 'attente'
      ? this.cotisationService.getCotisationsEnAttente()
      : this.cotisationService.getToutesCotisations();

    observable.subscribe({
      next: (cotisations) => {
        this.cotisations = cotisations;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement cotisations:', err);
        this.errorMessage = 'Erreur lors du chargement des cotisations';
        this.loading = false;
      }
    });
  }

  async valider(cotisation: Cotisation): Promise<void> {
    const membreNom = cotisation.membreNom || `Membre #${cotisation.membreId}`;
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: `Confirmer la validation de la cotisation de ${membreNom} pour ${cotisation.montant} FCFA ?` })) {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.errorMessage = 'Utilisateur non connecté';
      return;
    }

    const tresorierId = currentUser.id || 1;

    this.cotisationService.validerCotisation(cotisation.id, tresorierId).subscribe({
      next: () => {
        const membreNom = cotisation.membreNom || `Membre #${cotisation.membreId}`;
        this.successMessage = `Cotisation de ${membreNom} validée avec succès ! Montant: ${cotisation.montant} FCFA`;
        this.loadCotisations();
        this.loadStats();
      },
      error: (err) => {
        console.error('Erreur validation:', err);
        this.errorMessage = err.error?.message || err.error?.error || 'Erreur lors de la validation';
      }
    });
  }

  showRejetModal(cotisation: Cotisation): void {
    this.selectedCotisation = cotisation;
    this.motifRejet = '';
    this.showRejetModalFlag = true;
  }

  closeRejetModal(): void {
    this.showRejetModalFlag = false;
    this.selectedCotisation = null;
    this.motifRejet = '';
  }

  confirmRejet(): void {
    if (!this.selectedCotisation || !this.motifRejet) {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.errorMessage = 'Utilisateur non connecté';
      return;
    }

    const tresorierId = currentUser.id || 1;

    this.cotisationService.rejeterCotisation(this.selectedCotisation.id, tresorierId, this.motifRejet).subscribe({
      next: () => {
        const membreNom = this.selectedCotisation!.membreNom || `Membre #${this.selectedCotisation!.membreId}`;
        this.successMessage = `Cotisation de ${membreNom} rejetée. Le membre peut soumettre un nouveau paiement.`;
        this.closeRejetModal();
        this.loadCotisations();
        this.loadStats();
      },
      error: (err) => {
        console.error('Erreur rejet:', err);
        this.errorMessage = err.error?.message || err.error?.error || 'Erreur lors du rejet';
        this.closeRejetModal();
      }
    });
  }

  showDetails(cotisation: Cotisation): void {
    const membreNom = cotisation.membreNom || `Membre #${cotisation.membreId}`;
    let details = `Détails de la cotisation\n\n`;
    details += `Membre: ${membreNom}\n`;
    if (cotisation.membreEmail) details += `Email: ${cotisation.membreEmail}\n`;
    details += `\nPériodes: ${cotisation.periodes}\n`;
    details += `Nombre de mois: ${cotisation.nombreMois}\n`;
    details += `Montant: ${cotisation.montant} FCFA\n`;
    details += `Mode: ${this.formatModePaiement(cotisation.modePaiement)}\n`;
    details += `Référence: ${cotisation.reference || 'Aucune'}\n`;
    details += `Statut: ${this.getStatutLabel(cotisation.statut)}\n`;
    if (cotisation.remarque) details += `Remarque: ${cotisation.remarque}\n`;

    if (cotisation.valideParTresorier) {
      details += `\nValidé par: Trésorier #${cotisation.valideParTresorier}\n`;
      details += `Date validation: ${cotisation.dateValidation}\n`;
    }

    this.dialog.alerte(details);
  }

  getInitials(nom?: string): string {
    if (!nom) return '?';
    const parts = nom.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return nom.substring(0, 2).toUpperCase();
  }

  formatPeriodes(periodes: string): string {
    if (!periodes) return '-';
    const periodesArray = periodes.split(',').map(p => this.formatMois(p.trim()));
    if (periodesArray.length <= 2) {
      return periodesArray.join(', ');
    }
    return `${periodesArray[0]} - ${periodesArray[periodesArray.length - 1]}`;
  }

  formatMois(periode: string): string {
    if (!periode) return periode;
    const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const parts = periode.split('-');
    if (parts.length === 2) {
      const moisIndex = parseInt(parts[1], 10) - 1;
      return `${mois[moisIndex]} ${parts[0]}`;
    }
    return periode;
  }

  formatModePaiement(mode?: string): string {
    const modes: Record<string, string> = {
      'MOBILE_MONEY': 'Mobile Money',
      'ESPECES': 'Espèces'
    };
    return mode ? (modes[mode] || mode) : '-';
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': 'En attente',
      'PAYE': 'Validé',
      'PARTIEL': 'Partiel',
      'EN_RETARD': 'En retard'
    };
    return labels[statut] || statut;
  }

  /** Trésorier peut valider/rejeter. L'admin ne fait que consulter. */
  get isTresorier(): boolean {
    return this.authService.hasRole('TRESORIER');
  }
}
