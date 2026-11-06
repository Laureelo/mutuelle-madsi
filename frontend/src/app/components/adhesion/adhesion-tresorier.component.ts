import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdhesionService } from '../../services/adhesion.service';
import { Adhesion, AdhesionStats } from '../../models/adhesion.model';
import { AuthService } from '../../services/auth.service';
import { MembreService } from '../../services/membre.service';
import { StatsService } from '../../services/stats.service';
import { RecuService } from '../../services/recu.service';
import { PreuveService } from '../../services/preuve.service';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-adhesion-tresorier',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-6">
            <h3 class="mb-0">Gestion des Adhésions</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end">
              <li class="breadcrumb-item"><a href="#">Accueil</a></li>
              <li class="breadcrumb-item active">Adhésions</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <!-- Statistiques -->
        <div class="row mb-4" *ngIf="stats">
          <div class="col-lg-3 col-6">
            <div class="small-box text-bg-info">
              <div class="inner">
                <h3>{{ stats.total }}</h3>
                <p>Total Adhésions</p>
              </div>
              <i class="small-box-icon bi bi-cash-stack"></i>
            </div>
          </div>
          <div class="col-lg-3 col-6">
            <div class="small-box text-bg-warning">
              <div class="inner">
                <h3>{{ stats.enAttente }}</h3>
                <p>En Attente</p>
              </div>
              <i class="small-box-icon bi bi-hourglass-split"></i>
            </div>
          </div>
          <div class="col-lg-3 col-6">
            <div class="small-box text-bg-success">
              <div class="inner">
                <h3>{{ stats.validees }}</h3>
                <p>Validées</p>
              </div>
              <i class="small-box-icon bi bi-check-circle"></i>
            </div>
          </div>
          <div class="col-lg-3 col-6">
            <div class="small-box text-bg-danger">
              <div class="inner">
                <h3>{{ stats.rejetees }}</h3>
                <p>Rejetées</p>
              </div>
              <i class="small-box-icon bi bi-x-circle"></i>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div class="alert alert-success alert-dismissible" *ngIf="successMessage">
          <button type="button" class="btn-close" (click)="successMessage = ''" aria-label="Close"></button>
          {{ successMessage }}
        </div>

        <div class="alert alert-danger alert-dismissible" *ngIf="errorMessage">
          <button type="button" class="btn-close" (click)="errorMessage = ''" aria-label="Close"></button>
          {{ errorMessage }}
        </div>

        <!-- Onglets -->
        <ul class="nav nav-tabs mb-3" role="tablist">
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              [class.active]="activeTab === 'attente'"
              (click)="activeTab = 'attente'; loadAdhesions()"
              type="button">
              En attente
              <span class="badge text-bg-warning ms-1" *ngIf="stats">{{ stats.enAttente }}</span>
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              [class.active]="activeTab === 'toutes'"
              (click)="activeTab = 'toutes'; loadAdhesions()"
              type="button">
              Toutes
              <span class="badge text-bg-secondary ms-1" *ngIf="stats">{{ stats.total }}</span>
            </button>
          </li>
        </ul>

        <!-- Loading -->
        <div *ngIf="loading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
          </div>
        </div>

        <!-- Liste des adhésions -->
        <div class="card" *ngIf="!loading">
          <div class="card-header">
            <h5 class="card-title mb-0">
              <i class="bi bi-list me-2"></i>
              {{ activeTab === 'attente' ? 'Adhésions en attente de validation' : 'Toutes les adhésions' }}
            </h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Membre</th>
                    <th>Montant</th>
                    <th>Mode</th>
                    <th>Référence</th>
                    <th>Preuve</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let adhesion of adhesions">
                    <td>{{ adhesion.id }}</td>
                    <td>
                      <a [routerLink]="['/membres', adhesion.membreId]" class="text-decoration-none">
                        {{ getMembreName(adhesion.membreId) || 'Chargement...' }}
                      </a>
                      <br>
                      <small class="text-muted">#{{ adhesion.membreId }}</small>
                    </td>
                    <td><strong>{{ adhesion.montant | number:'1.0-0' }} FCFA</strong></td>
                    <td>
                      <small>{{ adhesion.modePaiement }}</small>
                    </td>
                    <td>
                      <small class="text-muted">{{ adhesion.reference || '-' }}</small>
                    </td>
                    <td class="text-center">
                      <button
                        *ngIf="adhesion.aPreuve || adhesion.photoPreuve"
                        class="btn btn-sm btn-outline-primary"
                        (click)="voirPreuve(adhesion)"
                        title="Voir la preuve de paiement">
                        <i class="bi bi-file-earmark-image"></i>
                      </button>
                      <span *ngIf="!(adhesion.aPreuve || adhesion.photoPreuve)" class="text-muted">-</span>
                    </td>
                    <td>
                      <small>{{ adhesion.datePaiement | date:'dd/MM/yyyy HH:mm' }}</small>
                    </td>
                    <td>
                      <span class="badge"
                            [class.text-bg-warning]="adhesion.statut === 'EN_ATTENTE'"
                            [class.text-bg-success]="adhesion.statut === 'VALIDE'"
                            [class.text-bg-danger]="adhesion.statut === 'REJETE'">
                        {{ getStatutLabel(adhesion.statut) }}
                      </span>
                    </td>
                    <td>
                      <!-- Boutons Valider/Rejeter : uniquement pour le trésorier sur adhésions en attente -->
                      <div class="btn-group btn-group-sm" *ngIf="adhesion.statut === 'EN_ATTENTE' && isTresorier">
                        <button
                          class="btn btn-success"
                          (click)="valider(adhesion)"
                          title="Valider le paiement">
                          <i class="bi bi-check-circle"></i> Valider
                        </button>
                        <button
                          class="btn btn-danger"
                          (click)="showRejetModal(adhesion)"
                          title="Rejeter le paiement">
                          <i class="bi bi-x-circle"></i> Rejeter
                        </button>
                      </div>
                      <!-- Bouton Voir : pour admin (toutes adhésions) ou trésorier (adhésions déjà traitées) -->
                      <button
                        *ngIf="adhesion.statut !== 'EN_ATTENTE' || !isTresorier"
                        class="btn btn-sm btn-info"
                        (click)="showDetailsModal(adhesion)"
                        title="Voir les détails">
                        <i class="bi bi-eye"></i> Voir
                      </button>
                      <button *ngIf="adhesion.statut === 'VALIDE' && adhesion.operationId" class="btn btn-sm btn-outline-success ms-1"
                              (click)="recus.ouvrirOperation(adhesion.operationId)" title="Télécharger le reçu">
                        <i class="bi bi-file-earmark-pdf"></i> Reçu
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="adhesions.length === 0">
                    <td colspan="9" class="text-center text-muted py-4">
                      <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                      Aucune adhésion {{ activeTab === 'attente' ? 'en attente' : '' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Modal de rejet -->
        <div class="modal fade" [class.show]="showRejetModalFlag" [style.display]="showRejetModalFlag ? 'block' : 'none'" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Rejeter l'adhésion</h5>
                <button type="button" class="btn-close" (click)="closeRejetModal()"></button>
              </div>
              <div class="modal-body">
                <p>Êtes-vous sûr de vouloir rejeter cette adhésion ?</p>
                <div class="mb-3">
                  <label for="motifRejet" class="form-label">Motif du rejet <span class="text-danger">*</span></label>
                  <textarea
                    id="motifRejet"
                    class="form-control"
                    [(ngModel)]="motifRejet"
                    rows="3"
                    placeholder="Expliquez pourquoi le paiement est rejeté..."></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closeRejetModal()">Annuler</button>
                <button
                  type="button"
                  class="btn btn-danger"
                  (click)="confirmRejet()"
                  [disabled]="!motifRejet || motifRejet.trim() === ''">
                  Rejeter
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop fade" [class.show]="showRejetModalFlag" *ngIf="showRejetModalFlag"></div>

        <!-- Modal Preuve de paiement -->
        <div class="modal fade" [class.show]="showPreuveModalFlag" [style.display]="showPreuveModalFlag ? 'block' : 'none'" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Preuve de paiement - Adhésion #{{ selectedAdhesionForPreuve?.id }}</h5>
                <button type="button" class="btn-close" (click)="closePreuveModal()"></button>
              </div>
              <div class="modal-body text-center">
                <img *ngIf="selectedAdhesionForPreuve?.photoPreuve"
                     [src]="selectedAdhesionForPreuve?.photoPreuve || ''"
                     alt="Preuve de paiement"
                     class="img-fluid rounded"
                     style="max-height: 600px;">
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closePreuveModal()">Fermer</button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop fade" [class.show]="showPreuveModalFlag" *ngIf="showPreuveModalFlag"></div>

        <!-- Modal Détails Adhésion -->
        <div class="modal fade" [class.show]="showDetailsModalFlag" [style.display]="showDetailsModalFlag ? 'block' : 'none'" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  <i class="bi bi-info-circle me-2"></i>
                  Détails de l'adhésion #{{ selectedAdhesionForDetails?.id }}
                </h5>
                <button type="button" class="btn-close" (click)="closeDetailsModal()"></button>
              </div>
              <div class="modal-body" *ngIf="selectedAdhesionForDetails">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <strong>Membre:</strong><br>
                    <a [routerLink]="['/membres', selectedAdhesionForDetails.membreId]" class="text-decoration-none" (click)="closeDetailsModal()">
                      {{ getMembreName(selectedAdhesionForDetails.membreId) || 'Chargement...' }}
                    </a>
                    <br><small class="text-muted">#{{ selectedAdhesionForDetails.membreId }}</small>
                  </div>
                  <div class="col-md-6">
                    <strong>Montant:</strong><br>
                    <span class="fs-5 fw-bold text-success">{{ selectedAdhesionForDetails.montant | number:'1.0-0' }} FCFA</span>
                  </div>
                </div>

                <div class="row mb-3">
                  <div class="col-md-6">
                    <strong>Mode de paiement:</strong><br>
                    {{ selectedAdhesionForDetails.modePaiement }}
                  </div>
                  <div class="col-md-6">
                    <strong>Référence:</strong><br>
                    {{ selectedAdhesionForDetails.reference || '-' }}
                  </div>
                </div>

                <div class="row mb-3">
                  <div class="col-md-6">
                    <strong>Date de paiement:</strong><br>
                    {{ selectedAdhesionForDetails.datePaiement | date:'dd/MM/yyyy HH:mm' }}
                  </div>
                  <div class="col-md-6">
                    <strong>Statut:</strong><br>
                    <span class="badge"
                          [class.text-bg-warning]="selectedAdhesionForDetails.statut === 'EN_ATTENTE'"
                          [class.text-bg-success]="selectedAdhesionForDetails.statut === 'VALIDE'"
                          [class.text-bg-danger]="selectedAdhesionForDetails.statut === 'REJETE'">
                      {{ getStatutLabel(selectedAdhesionForDetails.statut) }}
                    </span>
                  </div>
                </div>

                <!-- Motif de rejet (pour adhésions rejetées) -->
                <div class="row mb-3" *ngIf="selectedAdhesionForDetails.statut === 'REJETE'">
                  <div class="col-12">
                    <strong>Motif de rejet :</strong><br>
                    <div class="alert alert-danger">
                      <i class="bi bi-x-circle-fill me-2"></i>
                      {{ selectedAdhesionForDetails.motifRejet || 'Aucun motif spécifié' }}
                    </div>
                  </div>
                </div>

                <!-- Remarques du membre (si présentes) -->
                <div class="row mb-3" *ngIf="selectedAdhesionForDetails.remarque">
                  <div class="col-12">
                    <strong>Remarques du membre :</strong><br>
                    <div class="alert alert-info">
                      <i class="bi bi-info-circle-fill me-2"></i>
                      {{ selectedAdhesionForDetails.remarque }}
                    </div>
                  </div>
                </div>

                <div class="row mb-3" *ngIf="selectedAdhesionForDetails.aPreuve || selectedAdhesionForDetails.photoPreuve">
                  <div class="col-12">
                    <strong>Preuve de paiement:</strong><br>
                    <div class="text-center mt-2">
                      <img *ngIf="selectedAdhesionForDetails.photoPreuve" [src]="selectedAdhesionForDetails.photoPreuve"
                           alt="Preuve de paiement"
                           class="img-fluid rounded"
                           style="max-height: 400px; cursor: pointer;"
                           (click)="voirPreuve(selectedAdhesionForDetails)">
                      <br><small class="text-muted">Cliquez pour agrandir</small>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closeDetailsModal()">Fermer</button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop fade" [class.show]="showDetailsModalFlag" *ngIf="showDetailsModalFlag"></div>
      </div>
    </div>
  `,
  styles: [`
    .modal.show {
      display: block;
    }
    .modal-backdrop.show {
      opacity: 0.5;
    }
  `]
})
export class AdhesionTresorierComponent implements OnInit {
  private dialog = inject(DialogService);
  private adhesionService = inject(AdhesionService);
  preuves = inject(PreuveService);
  recus = inject(RecuService);
  private authService = inject(AuthService);
  private membreService = inject(MembreService);
  private statsService = inject(StatsService);

  adhesions: Adhesion[] = [];
  stats: AdhesionStats | null = null;
  loading = false;
  successMessage = '';
  errorMessage = '';
  activeTab: 'attente' | 'toutes' = 'attente';
  
  // Cache des noms de membres
  membresCache: Map<number, string> = new Map();

  // Modal rejet
  showRejetModalFlag = false;
  selectedAdhesion: Adhesion | null = null;
  motifRejet = '';

  // Modal preuve de paiement
  showPreuveModalFlag = false;
  selectedAdhesionForPreuve: Adhesion | null = null;

  // Modal détails adhésion
  showDetailsModalFlag = false;
  selectedAdhesionForDetails: Adhesion | null = null;

  ngOnInit(): void {
    this.loadStats();
    this.loadAdhesions();
  }

  loadStats(): void {
    this.adhesionService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (err) => {
        console.error('Erreur chargement stats:', err);
      }
    });
  }

  loadAdhesions(): void {
    this.loading = true;
    this.errorMessage = '';

    const observable = this.activeTab === 'attente'
      ? this.adhesionService.getEnAttente()
      : this.adhesionService.getAll();

    observable.subscribe({
      next: (adhesions) => {
        this.adhesions = adhesions;
        // Charger les noms des membres
        this.loadMembresNames(adhesions);
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement adhésions:', err);
        this.errorMessage = 'Erreur lors du chargement des adhésions';
        this.loading = false;
      }
    });
  }

  /**
   * Charge les noms des membres pour les adhésions
   */
  loadMembresNames(adhesions: Adhesion[]): void {
    const membreIds = [...new Set(adhesions.map(a => a.membreId))];
    
    membreIds.forEach(membreId => {
      // Ne charger que si pas déjà en cache
      if (!this.membresCache.has(membreId)) {
        this.membreService.getById(membreId).subscribe({
          next: (membre) => {
            const nom = `${membre.firstName} ${membre.lastName}`;
            this.membresCache.set(membreId, nom);
          },
          error: (err) => {
            // Compte supprimé depuis (données anciennes) : on garde « Membre #id » sans bruit
            if (err?.status !== 404) console.error(`Erreur chargement membre ${membreId}:`, err);
            this.membresCache.set(membreId, `Membre #${membreId}`);
          }
        });
      }
    });
  }

  /**
   * Retourne le nom du membre depuis le cache
   */
  getMembreName(membreId: number): string {
    return this.membresCache.get(membreId) || '';
  }

  async valider(adhesion: Adhesion): Promise<void> {
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: 'Confirmer la validation de cette adhésion ?' })) {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.errorMessage = 'Utilisateur non connecté';
      return;
    }

    if (!currentUser.id) {
      this.errorMessage = 'ID du trésorier introuvable. Veuillez vous reconnecter.';
      console.error('User ID manquant dans le token:', currentUser);
      return;
    }

    this.adhesionService.valider(adhesion.id, currentUser.id).subscribe({
      next: (response) => {
        this.successMessage = 'Adhésion validée avec succès ! Le membre est maintenant ACTIF. La trésorerie a été mise à jour.';
        this.loadAdhesions();
        this.loadStats();
        // Notifier le dashboard pour qu'il se rafraîchisse automatiquement
        // Attendre un peu pour que l'opération soit bien enregistrée en base
        setTimeout(() => {
          this.statsService.notifyRefresh();
        }, 500);
      },
      error: (err) => {
        console.error('Erreur validation:', err);
        this.errorMessage = err.error?.message || err.error?.error || 'Erreur lors de la validation';
      }
    });
  }

  showRejetModal(adhesion: Adhesion): void {
    this.selectedAdhesion = adhesion;
    this.motifRejet = '';
    this.showRejetModalFlag = true;
  }

  closeRejetModal(): void {
    this.showRejetModalFlag = false;
    this.selectedAdhesion = null;
    this.motifRejet = '';
  }

  confirmRejet(): void {
    if (!this.selectedAdhesion || !this.motifRejet) {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.errorMessage = 'Utilisateur non connecté';
      return;
    }

    if (!currentUser.id) {
      this.errorMessage = 'ID du trésorier introuvable. Veuillez vous reconnecter.';
      console.error('User ID manquant dans le token:', currentUser);
      return;
    }

    this.adhesionService.rejeter(this.selectedAdhesion.id, currentUser.id, this.motifRejet).subscribe({
      next: (response) => {
        this.successMessage = 'Adhésion rejetée.';
        this.closeRejetModal();
        this.loadAdhesions();
        this.loadStats();
      },
      error: (err) => {
        console.error('Erreur rejet:', err);
        this.errorMessage = err.error?.message || err.error?.error || 'Erreur lors du rejet';
        this.closeRejetModal();
      }
    });
  }

  showDetailsModal(adhesion: Adhesion): void {
    this.selectedAdhesionForDetails = adhesion;
    this.showDetailsModalFlag = true;
    this.chargerPreuve(adhesion);
  }

  /** L'image de la preuve n'est pas dans la liste : elle se charge à l'ouverture. */
  private chargerPreuve(adhesion: Adhesion): void {
    if (!adhesion.photoPreuve && adhesion.aPreuve) {
      this.preuves.charger('adhesions', adhesion.id).subscribe({
        next: (data) => { adhesion.photoPreuve = data; },
        error: () => { this.dialog.erreur('Impossible de charger la preuve de paiement.'); }
      });
    }
  }

  closeDetailsModal(): void {
    this.showDetailsModalFlag = false;
    this.selectedAdhesionForDetails = null;
  }

  voirPreuve(adhesion: Adhesion): void {
    this.selectedAdhesionForPreuve = adhesion;
    this.showPreuveModalFlag = true;
    this.chargerPreuve(adhesion);
  }

  closePreuveModal(): void {
    this.showPreuveModalFlag = false;
    this.selectedAdhesionForPreuve = null;
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': 'En attente',
      'VALIDE': 'Validé',
      'REJETE': 'Rejeté'
    };
    return labels[statut] || statut;
  }

  /** Trésorier peut valider/rejeter. L'admin ne fait que consulter. */
  get isTresorier(): boolean {
    return this.authService.hasRole('TRESORIER');
  }
}
