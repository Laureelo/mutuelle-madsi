import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OperationService } from '../../services/operation.service';
import { Operation, SensOp, TypeOperation } from '../../models/operation.model';
import { PageResponse } from '../../models/common.model';
import { MembreService } from '../../services/membre.service';
import { Membre } from '../../models/membre.model';
import { PreuveService } from '../../services/preuve.service';
import { AuthService } from '../../services/auth.service';
import { RecuService } from '../../services/recu.service';
import { ManifestationService } from '../../services/manifestation.service';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-operations-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Gestion des Opérations</h1>
        </div>
        <button class="btn btn-primary" (click)="showFormModal()">
          <i class="fas fa-plus"></i> Nouvelle Opération
        </button>
      </div>

      <!-- Solde à une date (vérification de la caisse, commissaire aux comptes) -->
      <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <label class="mb-0 text-muted" for="dateSolde">Situation de la caisse au</label>
        <input id="dateSolde" type="date" class="form-control form-control-sm w-auto" [(ngModel)]="dateSolde"
               [max]="aujourdhui" (change)="loadSolde()" />
        <button *ngIf="dateSolde" type="button" class="btn btn-sm btn-outline-secondary" (click)="dateSolde = ''; loadSolde()">
          Revenir à aujourd'hui
        </button>
        <small class="text-muted" *ngIf="dateSolde">Entrées, sorties et solde cumulés jusqu'à la fin de cette journée.</small>
      </div>

      <!-- Cartes Résumé -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon bg-primary">
            <i class="bi bi-wallet2"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ formatMoney(solde) }}</span>
            <span class="stat-label">{{ dateSolde ? 'Solde au ' + formatJour(dateSolde) : 'Solde (FCFA)' }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-success">
            <i class="bi bi-arrow-down-circle-fill"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ formatMoney(totalEntrees) }}</span>
            <span class="stat-label">Total Entrées</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-danger">
            <i class="bi bi-arrow-up-circle-fill"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ formatMoney(totalSorties) }}</span>
            <span class="stat-label">Total Sorties</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-info">
            <i class="bi bi-list-check"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ totalElements }}</span>
            <span class="stat-label">Opérations</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <div class="filter-group">
          <select class="form-control" [(ngModel)]="filterSens" (change)="onFilterChange()">
            <option value="">Tous les sens</option>
            <option value="ENTREE">Entrée</option>
            <option value="SORTIE">Sortie</option>
          </select>
        </div>
        <div class="filter-group">
          <select class="form-control" [(ngModel)]="filterTypeOp" (change)="onFilterChange()">
            <option value="">Tous les types</option>
            <option value="COTISATION">Cotisation</option>
            <option value="APPORT">Apport</option>
            <option value="RECETTE">Recette</option>
            <option value="DEPENSE">Dépense</option>
            <option value="REMBOURSEMENT_PRET">Remboursement Prêt</option>
          </select>
        </div>
        <div class="filter-group">
          <input
            type="date"
            class="form-control"
            [(ngModel)]="filterDateDebut"
            (change)="onFilterChange()"
            placeholder="Date début"
          />
        </div>
        <div class="filter-group">
          <input
            type="date"
            class="form-control"
            [(ngModel)]="filterDateFin"
            (change)="onFilterChange()"
            placeholder="Date fin"
          />
        </div>
      </div>

      <div *ngIf="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Chargement...</p>
      </div>

      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>

      <div *ngIf="!loading && !error" class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Catégorie</th>
              <th>Description</th>
              <th>Membre</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let operation of operations">
              <td>{{ formatDate(operation.dateOp) }}</td>
              <td>
                <span class="badge" [class]="'badge-' + operation.sens">
                  {{ getSens(operation.sens) }}
                </span>
              </td>
              <td><span class="badge badge-categorie">{{ getTypeOperation(operation.typeOp) }}</span></td>
              <td>{{ getDescription(operation) }}</td>
              <td>{{ operation.membrePrenom || '' }} {{ operation.membreNom || '' }}</td>
              <td>
                <strong [class.text-success]="operation.sens === 'ENTREE'" [class.text-danger]="operation.sens === 'SORTIE'">
                  {{ operation.sens === 'ENTREE' ? '+' : '-' }} {{ formatMoney(operation.montant) }} FCFA
                </strong>
              </td>
              <td>
                <span class="badge" [ngClass]="classeStatut(operation)">{{ libelleStatut(operation) }}</span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-icon" (click)="viewDetails(operation)" title="Détails"><i class="fas fa-eye"></i></button>
                  <button *ngIf="operation.statut === 'ENREGISTREE'" class="btn-icon btn-success"
                          (click)="recus.ouvrirOperation(operation.id)" title="Reçu"><i class="fas fa-file-pdf"></i></button>
                  <button *ngIf="estAdmin && operation.statut === 'EN_ATTENTE_CONFIRMATION'" class="btn-icon btn-success"
                          (click)="confirmerDepense(operation)" title="Confirmer cette dépense (président)"><i class="fas fa-user-check"></i></button>
                  <button *ngIf="estAdmin && operation.statut === 'EN_ATTENTE_CONFIRMATION'" class="btn-icon btn-danger"
                          (click)="refuserDepense(operation)" title="Refuser cette dépense (président)"><i class="fas fa-user-times"></i></button>
                  <button *ngIf="peutAnnuler(operation)" class="btn-icon btn-danger"
                          (click)="annulerOperation(operation)" title="Annuler cette opération"><i class="fas fa-ban"></i></button>
                </div>
              </td>
            </tr>
            <tr *ngIf="operations.length === 0">
              <td colspan="8" class="text-center">Aucune opération trouvée</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && totalPages > 1" class="pagination">
        <button class="btn btn-secondary" [disabled]="currentPage === 0" (click)="goToPage(currentPage - 1)">Précédent</button>
        <span class="page-info">Page {{ currentPage + 1 }} sur {{ totalPages }} ({{ totalElements }} opérations)</span>
        <button class="btn btn-secondary" [disabled]="currentPage === totalPages - 1" (click)="goToPage(currentPage + 1)">Suivant</button>
      </div>

      <!-- Create Modal -->
      <div *ngIf="showCreateForm" class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nouvelle Opération</h2>
            <button class="btn-close" (click)="closeModal()" type="button">&times;</button>
          </div>
          
          <form (ngSubmit)="onSubmit($event); $event.preventDefault()" *ngIf="!loadingMembers">
            <div class="form-group">
              <label>Type d'opération <span class="required">*</span></label>
              <select 
                class="form-control" 
                [(ngModel)]="formData.typeOp" 
                name="typeOp" 
                required
                [class.is-invalid]="formError && !formData.typeOp">
                <option [value]="''">Sélectionner un type</option>
                <option value="APPORT">Apport (Entrée)</option>
                <option value="RECETTE">Recette (Entrée)</option>
                <option value="DEPENSE">Dépense (Sortie)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Montant (FCFA) <span class="required">*</span></label>
              <input 
                type="number" 
                class="form-control" 
                [(ngModel)]="formData.montant" 
                name="montant" 
                min="0" 
                step="0.01" 
                required
                [class.is-invalid]="formError && (!formData.montant || formData.montant <= 0)" />
            </div>

            <div class="form-group">
              <label>Mode de paiement <span class="required">*</span></label>
              <select 
                class="form-control" 
                [(ngModel)]="formData.modePaiement" 
                name="modePaiement" 
                required
                [class.is-invalid]="formError && !formData.modePaiement">
                <option [value]="''">Sélectionner un mode</option>
                <option value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>

            <div class="form-group">
              <label>Référence</label>
              <input 
                type="text" 
                class="form-control" 
                [(ngModel)]="formData.reference" 
                name="reference" 
                maxlength="100"
                placeholder="Numéro de transaction, bordereau, etc." />
            </div>

            <div class="form-group" *ngIf="formData.typeOp === 'DEPENSE'">
              <label>Prestation ou activité concernée (facultatif)</label>
              <select class="form-control" [(ngModel)]="formData.manifestationId" name="manifestationId" (ngModelChange)="onManifestationChoisie($event)">
                <option [ngValue]="null">Aucune : dépense ordinaire</option>
                <option *ngFor="let ma of manifestations" [ngValue]="ma.id">
                  {{ ma.libelle }} - {{ ma.date }}{{ ma.membrePrenom ? ' (' + ma.membrePrenom + ' ' + ma.membreNom + ')' : '' }}
                </option>
              </select>
              <small class="text-muted">Choisissez la manifestation pour que la somme versée soit comptée dans le coût des activités.</small>
            </div>

            <div class="form-group">
              <label>Membre (optionnel)</label>
              <select 
                class="form-control" 
                [(ngModel)]="formData.membreId" 
                name="membreId">
                <option [ngValue]="null">Aucun membre</option>
                <option *ngFor="let m of membres" [ngValue]="m.id">
                  {{ m.firstName }} {{ m.lastName }}
                </option>
              </select>
            </div>

            <div *ngIf="formError" class="alert alert-danger">{{ formError }}</div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
              <button type="submit" class="btn btn-primary" [disabled]="saving || !isFormValid()">
                <span *ngIf="saving">Enregistrement...</span>
                <span *ngIf="!saving">Enregistrer</span>
              </button>
            </div>
          </form>

          <div *ngIf="loadingMembers" class="loading-state">
            <div class="spinner"></div>
            <p>Chargement des membres...</p>
          </div>
        </div>
      </div>

      <!-- Details Modal -->
      <div *ngIf="showDetailsModal && selectedOperation" class="modal-overlay" (click)="closeDetailsModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Détails de l'opération #{{ selectedOperation.id }}</h2>
            <button class="btn-close" (click)="closeDetailsModal()" type="button">&times;</button>
          </div>

          <div class="details-content">
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">{{ formatDate(selectedOperation.dateOp) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="badge" [class]="'badge-' + selectedOperation.sens">{{ getSens(selectedOperation.sens) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Catégorie:</span>
              <span class="badge badge-categorie">{{ getTypeOperation(selectedOperation.typeOp) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Montant:</span>
              <span class="detail-value">
                <strong [class.text-success]="selectedOperation.sens === 'ENTREE'" [class.text-danger]="selectedOperation.sens === 'SORTIE'">
                  {{ selectedOperation.sens === 'ENTREE' ? '+' : '-' }} {{ formatMoney(selectedOperation.montant) }} FCFA
                </strong>
              </span>
            </div>
            <div class="detail-row" *ngIf="selectedOperation.modePaiement">
              <span class="detail-label">Mode de paiement:</span>
              <span class="detail-value">{{ selectedOperation.modePaiement === 'MOBILE_MONEY' ? 'Mobile Money' : 'Espèces' }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedOperation.reference">
              <span class="detail-label">Référence:</span>
              <span class="detail-value">{{ selectedOperation.reference }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedOperation.membreNom || selectedOperation.membrePrenom">
              <span class="detail-label">Membre:</span>
              <span class="detail-value">{{ selectedOperation.membrePrenom }} {{ selectedOperation.membreNom }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedOperation.statut">
              <span class="detail-label">Statut:</span>
              <span class="detail-value">{{ selectedOperation.statut }}</span>
            </div>

            <!-- Preuve de paiement -->
            <div class="detail-row" *ngIf="selectedOperation.aPreuve || selectedOperation.photoPreuve">
              <span class="detail-label">Preuve de paiement:</span>
              <span class="detail-value">
                <img
                  *ngIf="selectedOperation.photoPreuve && isBase64Image(selectedOperation.photoPreuve)"
                  [src]="selectedOperation.photoPreuve"
                  alt="Preuve de paiement"
                  class="preuve-image"
                  (click)="openPreuveModal(selectedOperation.photoPreuve)" />
                <a *ngIf="selectedOperation.photoPreuve && !isBase64Image(selectedOperation.photoPreuve)" [href]="selectedOperation.photoPreuve" target="_blank" class="preuve-link">
                  <i class="fas fa-external-link-alt"></i> Voir la preuve
                </a>
              </span>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeDetailsModal()">Fermer</button>
          </div>
        </div>
      </div>

      <!-- Modal de visualisation de la preuve -->
      <div *ngIf="showPreuveModal" class="modal-overlay preuve-overlay" (click)="closePreuveModal()">
        <div class="preuve-modal-content" (click)="$event.stopPropagation()">
          <button class="btn-close preuve-close" (click)="closePreuveModal()" type="button">&times;</button>
          <img [src]="currentPreuveImage" alt="Preuve de paiement" class="preuve-fullsize" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 30px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .page-header h1 { font-size: 28px; color: #333; margin: 0; }

    .stats-row { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat-card { background: white; border-radius: 8px; padding: 20px; display: flex; align-items: center; gap: 15px; flex: 1; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-icon { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; }
    .stat-icon.bg-primary { background: #667eea; }
    .stat-icon.bg-success { background: #28a745; }
    .stat-icon.bg-danger { background: #dc3545; }
    .stat-icon.bg-info { background: #17a2b8; }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: 20px; font-weight: 700; color: #333; }
    .stat-label { font-size: 14px; color: #6c757d; }

    .filters-section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .filter-group { flex: 1; }
    .form-control { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; }
    .form-control:focus { outline: none; border-color: #667eea; }

    .loading-state { text-align: center; padding: 60px 20px; background: white; border-radius: 8px; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .alert { padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }

    .table-container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { background: #f8f9fa; padding: 15px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #dee2e6; }
    .data-table td { padding: 15px; border-bottom: 1px solid #dee2e6; }
    .data-table tbody tr:hover { background: #f8f9fa; }

    .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; display: inline-block; }
    .badge-ENTREE { background: #d4edda; color: #155724; }
    .badge-SORTIE { background: #f8d7da; color: #721c24; }
    .badge-categorie { background: #e9ecef; color: #495057; }

    .text-success { color: #28a745; }
    .text-danger { color: #dc3545; }

    .action-buttons { display: flex; gap: 5px; }
    .btn, .btn-icon { padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; transition: all 0.3s; }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5568d3; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #5a6268; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-icon { padding: 6px 10px; background: #f8f9fa; border: 1px solid #dee2e6; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; }
    .btn-icon i { font-size: 14px; }
    .btn-icon:hover { background: #e9ecef; }

    .pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 20px; background: white; border-radius: 8px; }
    .page-info { color: #6c757d; }
    .text-center { text-align: center; }

    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 0; border-radius: 8px; max-width: 600px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-bottom: 1px solid #dee2e6; }
    .modal-header h2 { margin: 0; font-size: 24px; color: #333; }
    .btn-close { background: none; border: none; font-size: 28px; color: #6c757d; cursor: pointer; padding: 0; width: 30px; height: 30px; line-height: 1; }
    .btn-close:hover { color: #333; }
    .form-group { margin-bottom: 20px; padding: 0 30px; }
    .form-group:first-of-type { padding-top: 30px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
    .form-group .required { color: #dc3545; }
    .form-control.is-invalid { border-color: #dc3545; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 20px 30px; border-top: 1px solid #dee2e6; margin-top: 20px; }
    .modal-content form { padding: 0; }

    .details-content { padding: 30px; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: 600; color: #555; }
    .detail-value { color: #333; }

    .preuve-image { max-width: 150px; max-height: 100px; border-radius: 5px; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s; }
    .preuve-image:hover { transform: scale(1.05); }
    .preuve-link { color: #667eea; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; }
    .preuve-link:hover { text-decoration: underline; }
    .preuve-overlay { background: rgba(0,0,0,0.9); }
    .preuve-modal-content { position: relative; max-width: 90%; max-height: 90%; display: flex; align-items: center; justify-content: center; }
    .preuve-fullsize { max-width: 100%; max-height: 90vh; border-radius: 8px; }
    .preuve-close { position: absolute; top: -40px; right: 0; background: white; border-radius: 50%; width: 36px; height: 36px; font-size: 24px; }
  `]
})
export class OperationsListComponent implements OnInit {
  private dialog = inject(DialogService);
  private operationService = inject(OperationService);
  authService = inject(AuthService);
  recus = inject(RecuService);
  preuves = inject(PreuveService);
  private membreService = inject(MembreService);
  private manifestationService = inject(ManifestationService);
  private route = inject(ActivatedRoute);
  /** Activité à payer, quand on arrive depuis la liste des manifestations. */
  private payerManifId: number | null = null;

  operations: Operation[] = [];
  loading = false;
  error = '';
  showCreateForm = false;
  solde = 0;
  totalEntrees = 0;
  totalSorties = 0;

  filterSens = '';
  filterTypeOp = '';
  filterDateDebut = '';
  filterDateFin = '';

  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // Formulaire
  formData: {
    typeOp: string;
    montant: number | null;
    modePaiement: string;
    reference: string;
    membreId: number | null;
    manifestationId: number | null;
  } = {
    typeOp: '',
    montant: null,
    modePaiement: '',
    reference: '',
    membreId: null,
    manifestationId: null
  };
  manifestations: any[] = [];
  membres: Membre[] = [];
  loadingMembers = false;
  saving = false;
  formError = '';

  // Details modal
  showDetailsModal = false;
  selectedOperation: Operation | null = null;

  // Preuve modal
  showPreuveModal = false;
  currentPreuveImage = '';

  ngOnInit(): void {
    this.loadOperations();
    this.loadSolde();
    const payer = Number(this.route.snapshot.queryParamMap.get('payer'));
    if (payer > 0) {
      this.payerManifId = payer;
      this.showFormModal();
    }
  }

  loadOperations(): void {
    this.loading = true;
    this.error = '';

    this.operationService.getAll({
      sens: this.filterSens ? this.filterSens as SensOp : undefined,
      typeOp: this.filterTypeOp ? this.filterTypeOp as TypeOperation : undefined,
      dateFrom: this.filterDateDebut || undefined,
      dateTo: this.filterDateFin || undefined,
      page: this.currentPage,
      size: this.pageSize
    }).subscribe({
      next: (response: PageResponse<Operation>) => {
        this.operations = response.content;
        this.totalPages = response.totalPages;
        this.totalElements = response.totalElements;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  /** Date choisie pour consulter la caisse (vide = aujourd'hui). */
  dateSolde = '';
  readonly aujourdhui = new Date().toISOString().slice(0, 10);

  formatJour(iso: string): string {
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
  }

  loadSolde(): void {
    this.operationService.getSolde(this.dateSolde || undefined).subscribe({
      next: (response) => {
        this.solde = response.soldeTotal;
        this.totalEntrees = response.totalEntrees;
        this.totalSorties = response.totalSorties;
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement du solde:', err);
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadOperations();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadOperations();
  }

  viewDetails(operation: Operation): void {
    this.selectedOperation = operation;
    this.showDetailsModal = true;
    // L'image de la preuve n'est pas dans la liste : elle se charge à l'ouverture
    if (!operation.photoPreuve && operation.aPreuve) {
      this.preuves.charger('operations', operation.id).subscribe({
        next: (data) => { operation.photoPreuve = data; },
        error: () => { this.dialog.erreur('Impossible de charger la preuve de paiement.'); }
      });
    }
  }

  // ---- Statut, confirmation du président et annulation ----

  get estAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  get estTresorier(): boolean {
    return this.authService.hasRole('TRESORIER');
  }

  libelleStatut(op: any): string {
    switch (op.statut) {
      case 'ANNULEE': return 'Annulée';
      case 'EN_ATTENTE_CONFIRMATION': return 'En attente du président';
      default: return 'Enregistrée';
    }
  }

  classeStatut(op: any): string {
    switch (op.statut) {
      case 'ANNULEE': return 'text-bg-secondary';
      case 'EN_ATTENTE_CONFIRMATION': return 'text-bg-warning';
      default: return 'text-bg-success';
    }
  }

  /** Les opérations d'adhésion et de prêt suivent leur propre circuit : on ne les annule pas ici. */
  peutAnnuler(op: any): boolean {
    return this.estTresorier && op.statut === 'ENREGISTREE'
      && !['adhesion', 'pret', 'remboursement'].includes(op.objetType || '');
  }

  async confirmerDepense(op: any): Promise<void> {
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: `Confirmer cette dépense de ${this.formatMoney(op.montant)} FCFA ?\nElle sortira de la caisse.` })) return;
    this.operationService.confirmer(op.id).subscribe({
      next: () => { this.loadOperations(); this.loadSolde(); },
      error: (err) => this.dialog.erreur('Erreur: ' + (err.error?.message || err.message))
    });
  }

  async refuserDepense(op: any): Promise<void> {
    const motif = await this.dialog.prompt({ titre: 'Motif', message: 'Motif du refus de cette dépense :', label: 'Motif', requis: true });
    if (!motif || !motif.trim()) return;
    this.operationService.refuser(op.id, motif.trim()).subscribe({
      next: () => { this.loadOperations(); },
      error: (err) => this.dialog.erreur('Erreur: ' + (err.error?.message || err.message))
    });
  }

  async annulerOperation(op: any): Promise<void> {
    const motif = await this.dialog.prompt({ titre: 'Motif', message: 'Motif de l\'annulation de cette opération :', label: 'Motif', requis: true });
    if (!motif || !motif.trim()) return;
    this.operationService.annuler(op.id, motif.trim()).subscribe({
      next: () => { this.loadOperations(); this.loadSolde(); },
      error: (err) => this.dialog.erreur('Erreur: ' + (err.error?.message || err.message))
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOperation = null;
  }

  isBase64Image(url: string): boolean {
    return url?.startsWith('data:image');
  }

  openPreuveModal(imageUrl: string): void {
    this.currentPreuveImage = imageUrl;
    this.showPreuveModal = true;
  }

  closePreuveModal(): void {
    this.showPreuveModal = false;
    this.currentPreuveImage = '';
  }

  getSens(sens: SensOp): string {
    const labels: Record<SensOp, string> = {
      [SensOp.ENTREE]: 'Entrée',
      [SensOp.SORTIE]: 'Sortie'
    };
    return labels[sens] || sens;
  }

  getTypeOperation(typeOp: TypeOperation): string {
    const labels: Record<TypeOperation, string> = {
      [TypeOperation.COTISATION]: 'Cotisation',
      [TypeOperation.APPORT]: 'Apport',
      [TypeOperation.RECETTE]: 'Recette',
      [TypeOperation.DEPENSE]: 'Dépense',
      [TypeOperation.REMBOURSEMENT_PRET]: 'Remboursement Prêt'
    };
    return labels[typeOp] || typeOp;
  }

  getDescription(operation: Operation): string {
    if (operation.description) {
      return operation.description;
    }
    // Générer une description basée sur le type d'opération
    const typeLabel = this.getTypeOperation(operation.typeOp);
    const n = operation.objetId ? ` n°${operation.objetId}` : '';
    switch (operation.objetType) {
      case 'cotisation': return `Cotisation${n}`;
      case 'adhesion': return `Droit d'adhésion${n}`;
      case 'pret': return `Prêt versé${n}`;
      case 'remboursement': return `Remboursement de prêt${n}`;
      case 'manifestation': return `Prestation ou activité${n}`;
      default: return typeLabel;
    }
  }

  formatDate(date: string): string {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return date;
    }
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount);
  }

  showFormModal(): void {
    this.showCreateForm = true;
    this.formError = '';
    this.formData = {
      typeOp: '',
      montant: null,
      modePaiement: '',
      reference: '',
      membreId: null,
      manifestationId: null
    };
    this.loadMembers();
  }

  closeModal(): void {
    this.showCreateForm = false;
    this.formError = '';
    this.saving = false;
    this.formData = {
      typeOp: '',
      montant: null,
      modePaiement: '',
      reference: '',
      membreId: null,
      manifestationId: null
    };
  }

  /** Une prestation concerne un bénéficiaire : on le propose automatiquement. */
  onManifestationChoisie(id: number | null): void {
    const ma = this.manifestations.find(x => x.id === id);
    if (ma?.membreId && !this.formData.membreId) this.formData.membreId = ma.membreId;
  }

  loadMembers(): void {
    this.loadingMembers = true;
    this.membreService.getAll({ page: 0, size: 1000 }).subscribe({
      next: (response) => {
        this.membres = response.content.filter(m => m.etatCompte === 'ACTIF');
        this.loadingMembers = false;
        this.manifestationService.getAll({ q: '', page: 0, size: 300 }).subscribe({
          next: (r) => {
            this.manifestations = r.content.filter(x => x.statut === 'PLANIFIEE' || x.statut === 'REALISEE');
            if (this.payerManifId) {
              const ma = this.manifestations.find(x => x.id === this.payerManifId);
              if (ma) {
                this.formData.typeOp = 'DEPENSE';
                this.formData.manifestationId = ma.id;
                this.formData.membreId = ma.membreId || null;
                const reste = (ma.montantPrevu || 0) - (ma.montantDepense || 0);
                this.formData.montant = reste > 0 ? reste : null;
              }
              this.payerManifId = null;
            }
          },
          error: () => { this.manifestations = []; }
        });
      },
      error: (err) => {
        console.error('Erreur lors du chargement des membres:', err);
        this.loadingMembers = false;
      }
    });
  }

  isFormValid(): boolean {
    return !!(
      this.formData.typeOp &&
      this.formData.montant &&
      this.formData.montant > 0 &&
      this.formData.modePaiement
    );
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.formError = '';

    // Validation
    if (!this.formData.typeOp) {
      this.formError = 'Veuillez sélectionner un type d\'opération';
      return;
    }
    if (!this.formData.montant || this.formData.montant <= 0) {
      this.formError = 'Le montant doit être supérieur à 0';
      return;
    }
    if (!this.formData.modePaiement) {
      this.formError = 'Veuillez sélectionner un mode de paiement';
      return;
    }

    this.saving = true;

    const data = {
      montant: Number(this.formData.montant),
      modePaiement: this.formData.modePaiement,
      reference: this.formData.reference || undefined,
      membreId: this.formData.membreId || undefined
    };

    let request$;
    if (this.formData.typeOp === 'APPORT') {
      request$ = this.operationService.createApport(data);
    } else if (this.formData.typeOp === 'RECETTE') {
      request$ = this.operationService.createRecette(data);
    } else if (this.formData.typeOp === 'DEPENSE') {
      request$ = this.formData.manifestationId
        ? this.operationService.createDepenseManifestation({ ...data, objetId: Number(this.formData.manifestationId) })
        : this.operationService.createDepense(data);
    } else {
      this.formError = 'Type d\'opération invalide';
      this.saving = false;
      return;
    }

    request$.subscribe({
      next: (ack: any) => {
        this.saving = false;
        this.closeModal();
        this.loadOperations();
        this.loadSolde();
        if (ack?.enAttenteConfirmation) {
          this.dialog.attention('Cette dépense dépasse le seuil de confirmation.\nElle est enregistrée « en attente » : elle n\'entrera en caisse qu\'après la confirmation du président (administrateur).');
        }
      },
      error: (err) => {
        this.saving = false;
        this.formError = 'Erreur lors de la création: ' + (err.error?.message || err.message || 'Erreur inconnue');
        console.error('Erreur création opération:', err);
      }
    });
  }
}
