import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CotisationService } from '../../services/cotisation.service';
import { AuthService } from '../../services/auth.service';
import { Cotisation, CotisationCreate, CotisationUpdate, StatutCotisation, ModePaiement, DeclarerCotisationInput } from '../../models/cotisation.model';
import { Membre, EtatCompte } from '../../models/membre.model';
import { PageResponse } from '../../models/common.model';
import { MontantsService } from '../../services/montants.service';
import { RecuService } from '../../services/recu.service';
import { PreuveService } from '../../services/preuve.service';
import { compresserImage } from '../../utils/image';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-cotisations-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Gestion des Cotisations</h1>
        <button class="btn btn-primary" (click)="showCreateFormModal()">
          <i class="fas fa-plus"></i> Déclarer ma cotisation
        </button>
      </div>

      <!-- Cartes Résumé -->
      <div class="stats-row" *ngIf="isTresorierOrAdmin">
        <div class="stat-card">
          <div class="stat-icon bg-info">
            <i class="bi bi-cash-stack"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ statsTotal }}</span>
            <span class="stat-label">Total Cotisations</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-warning">
            <i class="bi bi-hourglass-split"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ statsEnAttente }}</span>
            <span class="stat-label">En Attente</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-success">
            <i class="bi bi-check-circle-fill"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ statsPayees }}</span>
            <span class="stat-label">Payées</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-danger">
            <i class="bi bi-exclamation-circle-fill"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ statsEnRetard }}</span>
            <span class="stat-label">En Retard</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <div class="filter-group">
          <input
            type="text"
            class="form-control"
            placeholder="Période (ex: 2024-01)"
            [(ngModel)]="filterPeriode"
            (input)="onFilterChange()"
          />
        </div>
        <div class="filter-group">
          <select class="form-control" [(ngModel)]="filterStatut" (change)="onFilterChange()">
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="PAYE">Payé</option>
            <option value="PARTIEL">Partiel</option>
            <option value="EN_RETARD">En retard</option>
            <option value="REJETE">Rejeté</option>
          </select>
        </div>
        <div class="filter-group">
          <select class="form-control" [(ngModel)]="filterMode" (change)="onFilterChange()">
            <option value="">Tous les modes</option>
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
          </select>
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
              <th>Période</th>
              <th>Membre</th>
              <th>Montant</th>
              <th>Date Paiement</th>
              <th>Mode</th>
              <th>Preuve</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let cotisation of cotisations">
              <td><strong>{{ formatPeriodes(cotisation.periodes, cotisation.periode) }}</strong></td>
              <td>
                <strong>{{ cotisation.membreNom || 'Membre n°' + cotisation.membreId }}</strong>
                <br *ngIf="cotisation.membreEmail">
                <small class="text-muted" *ngIf="cotisation.membreEmail">{{ cotisation.membreEmail }}</small>
              </td>
              <td>{{ formatMoney(cotisation.montant) }} FCFA</td>
              <td>{{ formatDate(cotisation.datePaiement) }}</td>
              <td><span class="badge badge-mode">{{ getMode(cotisation.modePaiement) }}</span></td>
              <td class="text-center">
                <button
                  *ngIf="cotisation.aPreuve || cotisation.photoPreuve"
                  class="btn-icon btn-info"
                  (click)="voirPreuve(cotisation)"
                  title="Voir la preuve de paiement">
                  <i class="fas fa-image"></i>
                </button>
                <span *ngIf="!(cotisation.aPreuve || cotisation.photoPreuve)" class="text-muted">-</span>
              </td>
              <td><span class="badge" [class]="'badge-' + cotisation.statut">{{ getStatut(cotisation.statut) }}</span></td>
              <td>
                <div class="action-buttons">
                  <!-- Valider/Rejeter : uniquement pour le trésorier -->
                  <div *ngIf="isTresorier && cotisation.statut === 'EN_ATTENTE'" class="btn-group-tresorier">
                    <button class="btn-icon btn-success" (click)="validerCotisation(cotisation)" title="Valider la cotisation">
                      <i class="fas fa-check"></i> Valider
                    </button>
                    <button class="btn-icon btn-danger" (click)="showRejetModal(cotisation)" title="Rejeter la cotisation">
                      <i class="fas fa-times"></i> Rejeter
                    </button>
                  </div>
                  <!-- Voir : pour admin ou cotisations déjà traitées -->
                  <div *ngIf="!isTresorier || cotisation.statut !== 'EN_ATTENTE'">
                    <button class="btn-icon" (click)="viewDetails(cotisation)" title="Détails"><i class="fas fa-eye"></i></button>
                    <button *ngIf="cotisation.statut === 'PAYE' && cotisation.operationId" class="btn-icon btn-success"
                            (click)="recus.ouvrirOperation(cotisation.operationId)" title="Télécharger le reçu">
                      <i class="fas fa-file-pdf"></i>
                    </button>
                    <button *ngIf="cotisation.statut === 'EN_ATTENTE' && !isTresorierOrAdmin" class="btn-icon btn-info" title="En attente de validation">
                      <i class="fas fa-clock"></i>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <tr *ngIf="cotisations.length === 0">
              <td colspan="8" class="text-center">Aucune cotisation trouvée</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && totalPages > 1" class="pagination">
        <button class="btn btn-secondary" [disabled]="currentPage === 0" (click)="goToPage(currentPage - 1)">Précédent</button>
        <span class="page-info">Page {{ currentPage + 1 }} sur {{ totalPages }} ({{ totalElements }} cotisations)</span>
        <button class="btn btn-secondary" [disabled]="currentPage === totalPages - 1" (click)="goToPage(currentPage + 1)">Suivant</button>
      </div>

      <!-- Create Modal -->
      <div *ngIf="showCreateForm" class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nouvelle Cotisation</h2>
            <button class="btn-close" (click)="closeModal()" type="button">&times;</button>
          </div>
          
          <form (ngSubmit)="onSubmit()">
            <div class="alert alert-info">
              <strong>Montant total à payer : {{ montantTotal | number:'1.0-0' }} FCFA</strong>
              <p class="mb-0 small">Cotisation mensuelle : {{ montants.cotisation | number:'1.0-0' }} FCFA par mois</p>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Mois de début <span class="required">*</span></label>
                <input 
                  type="month" 
                  class="form-control" 
                  [(ngModel)]="formData.moisDebut" 
                  name="moisDebut" 
                  (change)="calculerMontant()"
                  required />
                <small class="text-muted">Format: AAAA-MM (ex: 2026-01)</small>
              </div>

              <div class="form-group">
                <label>Nombre de mois <span class="required">*</span></label>
                <select 
                  class="form-control" 
                  [(ngModel)]="formData.nombreMois" 
                  name="nombreMois" 
                  (change)="calculerMontant()"
                  required>
                  <option *ngFor="let n of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="n">{{ n }} mois ({{ n * montants.cotisation | number:'1.0-0' }} FCFA)</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Mode de paiement <span class="required">*</span></label>
                <select class="form-control" [(ngModel)]="formData.modePaiement" name="modePaiement" required>
                  <option value="">Sélectionner</option>
                  <option [value]="ModePaiement.ESPECES">Espèces</option>
                  <option [value]="ModePaiement.MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>

              <div class="form-group">
                <label>Référence / Numéro de transaction</label>
                <input 
                  type="text" 
                  class="form-control" 
                  [(ngModel)]="formData.reference" 
                  name="reference" 
                  placeholder="Ex: Transaction #123456789" />
                <small class="text-muted">Numéro de la transaction Mobile Money ou référence du paiement</small>
              </div>
            </div>

            <div class="form-group">
              <label>Remarque (optionnel)</label>
              <textarea 
                class="form-control" 
                [(ngModel)]="formData.remarque" 
                name="remarque" 
                rows="2"
                placeholder="Informations complémentaires..."></textarea>
            </div>

            <div class="form-group">
              <label for="photoPreuve">
                Preuve de paiement (optionnel)
                <i class="fas fa-info-circle" style="color: #6c757d; font-size: 0.9em;" title="Capture d'écran ou document du paiement"></i>
              </label>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input
                  type="file"
                  class="form-control"
                  id="photoPreuve"
                  accept="image/*"
                  (change)="onFileSelected($event)"
                  style="flex: 1;" />
                <button
                  *ngIf="selectedFileName"
                  type="button"
                  class="btn btn-outline-danger"
                  (click)="removeFile()"
                  title="Supprimer le fichier">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <small class="text-muted">
                Photo ou capture d'écran (JPG, PNG, WebP, max 5 Mo), réduite automatiquement
              </small>
              <div *ngIf="selectedFileName" class="mt-2">
                <small class="text-success">
                  <i class="fas fa-check-circle"></i>
                  Fichier sélectionné : {{ selectedFileName }}
                </small>
              </div>
            </div>

            <div *ngIf="formError" class="alert alert-danger">{{ formError }}</div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
              <button type="submit" class="btn btn-primary" [disabled]="saving">
                <span *ngIf="saving">Enregistrement...</span>
                <span *ngIf="!saving">Enregistrer</span>
              </button>
            </div>
          </form>

        </div>
      </div>

      <!-- Details Modal -->
      <div *ngIf="showDetailsModal && selectedCotisation" class="modal-overlay" (click)="closeDetailsModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Détails de la Cotisation</h2>
            <button class="btn-close" (click)="closeDetailsModal()" type="button">&times;</button>
          </div>
          
          <div class="details-content">
            <div class="detail-row">
              <span class="detail-label">ID:</span>
              <span class="detail-value">{{ selectedCotisation.id }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Membre:</span>
              <span class="detail-value">{{ selectedCotisation.membreNom || 'Membre #' + selectedCotisation.membreId }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">{{ selectedCotisation.membreEmail || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Périodes:</span>
              <span class="detail-value">{{ formatPeriodes(selectedCotisation.periodes, selectedCotisation.periode) }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedCotisation.nombreMois">
              <span class="detail-label">Nombre de mois:</span>
              <span class="detail-value">{{ selectedCotisation.nombreMois }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Montant:</span>
              <span class="detail-value">{{ formatMoney(selectedCotisation.montant) }} FCFA</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date de paiement:</span>
              <span class="detail-value">{{ formatDate(selectedCotisation.datePaiement) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Mode de paiement:</span>
              <span class="detail-value">{{ getMode(selectedCotisation.modePaiement) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Référence:</span>
              <span class="detail-value">{{ selectedCotisation.reference || '-' }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedCotisation.remarque">
              <span class="detail-label">Remarque:</span>
              <span class="detail-value">{{ selectedCotisation.remarque }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedCotisation.statut === 'REJETE'">
              <span class="detail-label">Motif de rejet:</span>
              <span class="detail-value" style="color: #dc3545; font-weight: 600;">
                <i class="bi bi-x-circle-fill me-2"></i>{{ selectedCotisation.motifRejet || 'Aucun motif spécifié' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Statut:</span>
              <span class="detail-value">
                <span class="badge" [class]="'badge-' + selectedCotisation.statut">
                  {{ getStatut(selectedCotisation.statut) }}
                </span>
              </span>
            </div>
            <div class="detail-row" *ngIf="selectedCotisation.statut === 'PAYE' && selectedCotisation.operationId">
              <span class="detail-label">Reçu de versement:</span>
              <span class="detail-value">
                <button class="btn btn-sm btn-success" (click)="recus.ouvrirOperation(selectedCotisation.operationId)">
                  <i class="fas fa-file-pdf"></i> Télécharger le reçu
                </button>
              </span>
            </div>
            <div class="detail-row" *ngIf="selectedCotisation.aPreuve || selectedCotisation.photoPreuve">
              <span class="detail-label">Preuve de paiement:</span>
              <span class="detail-value">
                <button class="btn btn-sm btn-info" (click)="voirPreuve(selectedCotisation)">
                  <i class="fas fa-image"></i> Voir la preuve
                </button>
              </span>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeDetailsModal()">Fermer</button>
            <button *ngIf="isTresorier && selectedCotisation.statut === 'EN_ATTENTE'" 
                    type="button" class="btn btn-success" (click)="validerCotisation(selectedCotisation)">
              <i class="fas fa-check"></i> Valider
            </button>
            <button *ngIf="isTresorier && selectedCotisation.statut === 'EN_ATTENTE'" 
                    type="button" class="btn btn-danger" (click)="showRejetModal(selectedCotisation)">
              <i class="fas fa-times"></i> Rejeter
            </button>
            <div *ngIf="selectedCotisation.statut === 'REJETE'" class="text-muted">
              <small><i class="fas fa-ban"></i> Cette cotisation a été rejetée</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de rejet -->
      <div *ngIf="showRejetModalFlag && selectedCotisationForRejet" class="modal-overlay" (click)="closeRejetModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Rejeter la cotisation</h2>
            <button class="btn-close" (click)="closeRejetModal()" type="button">&times;</button>
          </div>
          
          <div class="details-content">
            <p><strong>Êtes-vous sûr de vouloir rejeter cette cotisation ?</strong></p>
            <div class="form-group">
              <label>Motif du rejet <span class="required">*</span></label>
              <textarea 
                class="form-control" 
                [(ngModel)]="motifRejet" 
                name="motifRejet"
                rows="4"
                placeholder="Expliquez pourquoi le paiement est rejeté..."
                required></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeRejetModal()">Annuler</button>
            <button type="button" class="btn btn-danger" (click)="confirmRejet()" [disabled]="!motifRejet || motifRejet.trim() === ''">
              <i class="fas fa-times"></i> Rejeter
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Preuve de paiement -->
      <div *ngIf="showPreuveModalFlag && selectedCotisationForPreuve" class="modal-overlay" (click)="closePreuveModal()">
        <div class="modal-content modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Preuve de paiement - Cotisation #{{ selectedCotisationForPreuve.id }}</h2>
            <button class="btn-close" (click)="closePreuveModal()" type="button">&times;</button>
          </div>
          
          <div class="details-content text-center" style="padding: 30px;">
            <img *ngIf="selectedCotisationForPreuve.photoPreuve"
                 [src]="selectedCotisationForPreuve.photoPreuve"
                 alt="Preuve de paiement"
                 style="max-width: 100%; max-height: 600px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
            <p *ngIf="!selectedCotisationForPreuve.photoPreuve && selectedCotisationForPreuve.aPreuve" class="text-muted">Chargement de l'image...</p>
            <p *ngIf="!selectedCotisationForPreuve.photoPreuve && !selectedCotisationForPreuve.aPreuve" class="text-muted">Aucune preuve de paiement disponible</p>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closePreuveModal()">Fermer</button>
          </div>
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
    .stat-icon.bg-info { background: #17a2b8; }
    .stat-icon.bg-warning { background: #ffc107; color: #212529; }
    .stat-icon.bg-success { background: #28a745; }
    .stat-icon.bg-danger { background: #dc3545; }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: 24px; font-weight: 700; color: #333; }
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
    .badge-PAYE { background: #d4edda; color: #155724; }
    .badge-PARTIEL { background: #fff3cd; color: #856404; }
    .badge-EN_RETARD { background: #f8d7da; color: #721c24; }
    .badge-EN_ATTENTE { background: #fff3cd; color: #856404; }
    .badge-REJETE { background: #f8d7da; color: #721c24; border: 1px solid #dc3545; }
    .badge-mode { background: #e9ecef; color: #495057; }
    
    .btn-group-tresorier { display: flex; gap: 5px; }
    .btn-info { background: #17a2b8; color: white; border-color: #17a2b8; }
    .btn-info:hover { background: #138496; }

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
    .btn-success { background: #28a745; color: white; border-color: #28a745; }
    .btn-success:hover { background: #218838; }
    .btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
    .btn-danger:hover { background: #c82333; }

    .pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 20px; background: white; border-radius: 8px; }
    .page-info { color: #6c757d; }
    .text-center { text-align: center; }

    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 0; border-radius: 8px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .modal-lg { max-width: 900px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-bottom: 1px solid #dee2e6; }
    .modal-header h2 { margin: 0; font-size: 24px; color: #333; }
    .btn-close { background: none; border: none; font-size: 28px; color: #6c757d; cursor: pointer; padding: 0; width: 30px; height: 30px; line-height: 1; }
    .btn-close:hover { color: #333; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
    .form-group .required { color: #dc3545; }
    .form-row { display: flex; gap: 15px; }
    .form-row .form-group { flex: 1; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 20px 30px; border-top: 1px solid #dee2e6; margin-top: 20px; }
    .modal-content form { padding: 30px; }
    .details-content { padding: 30px; }
    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: 600; color: #666; min-width: 180px; }
    .detail-value { color: #333; flex: 1; }
  `]
})
export class CotisationsListComponent implements OnInit {
  private dialog = inject(DialogService);
  private cotisationService = inject(CotisationService);
  preuves = inject(PreuveService);
  montants = inject(MontantsService);
  recus = inject(RecuService);
  private authService = inject(AuthService);
  
  isTresorierOrAdmin = false;

  /** Trésorier peut valider/rejeter. L'admin ne fait que consulter. */
  get isTresorier(): boolean {
    return this.authService.hasRole('TRESORIER');
  }

  cotisations: Cotisation[] = [];
  loading = false;
  error = '';
  showCreateForm = false;
  saving = false;
  formError = '';

  // Stats pour les cartes résumé
  statsTotal = 0;
  statsEnAttente = 0;
  statsPayees = 0;
  statsEnRetard = 0;

  filterPeriode = '';
  filterStatut = '';
  filterMode = '';

  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  selectedCotisation: Cotisation | null = null;
  showDetailsModal = false;
  selectedCotisationForRejet: Cotisation | null = null;
  showRejetModalFlag = false;
  motifRejet = '';
  selectedCotisationForPreuve: Cotisation | null = null;
  showPreuveModalFlag = false;
  selectedFile: File | null = null;
  selectedFileName = '';

  formData: DeclarerCotisationInput = {
    membreId: 0,
    moisDebut: this.getCurrentMonth(),
    nombreMois: 1,
    modePaiement: ModePaiement.MOBILE_MONEY,
    reference: '',
    remarque: '',
    photoPreuve: undefined
  };

  montantTotal = 1000;

  StatutCotisation = StatutCotisation;
  ModePaiement = ModePaiement;

  ngOnInit(): void {
    // Vérifier si l'utilisateur est trésorier ou admin
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.roles) {
      this.isTresorierOrAdmin = currentUser.roles.some(role =>
        role === 'TRESORIER' || role === 'COMMISSAIRE' || role === 'ADMIN'
      );
    }

    // Initialiser le membreId avec l'ID de l'utilisateur connecté
    if (currentUser?.id) {
      this.formData.membreId = currentUser.id;
    }

    this.loadCotisations();
    if (this.isTresorierOrAdmin) {
      this.loadStats();
    }
  }

  loadStats(): void {
    this.cotisationService.getStats().subscribe({
      next: (stats) => {
        this.statsTotal = stats.total;
        this.statsEnAttente = stats.enAttente;
        this.statsPayees = stats.payees;
        this.statsEnRetard = stats.enRetard;
      },
      error: (err) => {
        console.error('Erreur chargement stats cotisations:', err);
      }
    });
  }

  getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  calculerMontant(): void {
    this.montantTotal = (this.formData.nombreMois || 1) * this.montants.cotisation;
  }

  showCreateFormModal(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.id) {
      this.formData = {
        membreId: currentUser.id,
        moisDebut: this.getCurrentMonth(),
        nombreMois: 1,
        modePaiement: ModePaiement.MOBILE_MONEY,
        reference: '',
        remarque: '',
        photoPreuve: undefined
      };
      this.montantTotal = 1000;
    }
    this.formError = '';
    this.removeFile(); // Réinitialiser le fichier
    this.showCreateForm = true;
  }

  closeModal(): void {
    this.showCreateForm = false;
    this.formError = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Vérifier la taille (max 5 MB)
      if (file.size > 5 * 1024 * 1024) {
        this.dialog.erreur('Le fichier est trop volumineux. Taille maximale : 5 MB');
        input.value = '';
        return;
      }
      
      this.selectedFile = file;
      this.selectedFileName = file.name;
      
      // Réduire la photo (taille et poids) avant envoi
      compresserImage(file).then(
        (image) => { this.formData.photoPreuve = image; },
        (err) => {
          this.dialog.erreur(err?.message || 'Image illisible. Choisissez une photo JPG, PNG ou WebP.');
          this.removeFile();
        }
      );
    }
  }

  removeFile(): void {
    this.selectedFile = null;
    this.selectedFileName = '';
    this.formData.photoPreuve = undefined;
    const input = document.getElementById('photoPreuve') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  onSubmit(): void {
    if (!this.formData.membreId || !this.formData.moisDebut || !this.formData.nombreMois || !this.formData.modePaiement) {
      this.formError = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    this.saving = true;
    this.formError = '';

    // Utiliser l'endpoint de déclaration (comme pour l'adhésion)
    this.cotisationService.declarer(this.formData).subscribe({
      next: (cotisation) => {
        console.log('Cotisation déclarée avec succès:', cotisation);
        this.saving = false;
        this.closeModal();
        this.loadCotisations();
      },
      error: (err) => {
        console.error('Erreur lors de la déclaration:', err);
        this.saving = false;
        let errorMessage = 'Erreur lors de l\'enregistrement';
        
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        // Messages d'erreur spécifiques
        if (errorMessage.includes('cotisation existe déjà') || errorMessage.includes('période')) {
          errorMessage = `Une cotisation existe déjà pour une ou plusieurs des périodes sélectionnées. Veuillez choisir d'autres périodes.`;
        } else if (errorMessage.includes('déjà enregistrée') || errorMessage.includes('EN ATTENTE')) {
          errorMessage = `Vous avez déjà une déclaration de cotisation en attente pour une ou plusieurs de ces périodes.`;
        }
        
        this.formError = errorMessage;
      }
    });
  }

  loadCotisations(): void {
    this.loading = true;
    this.error = '';

    // Si c'est un trésorier/admin, charger toutes les cotisations
    // Sinon, charger seulement les cotisations du membre connecté
    const currentUser = this.authService.getCurrentUser();
    
    if (this.isTresorierOrAdmin) {
      // Trésorier : charger toutes les cotisations
      this.cotisationService.getAll({
        periode: this.filterPeriode || undefined,
        statut: this.filterStatut ? this.filterStatut as StatutCotisation : undefined,
        modePaiement: this.filterMode ? this.filterMode as ModePaiement : undefined,
        page: this.currentPage,
        size: this.pageSize
      }).subscribe({
        next: (response: PageResponse<Cotisation>) => {
          this.cotisations = response.content;
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Erreur lors du chargement: ' + (err.error?.message || err.message);
          this.loading = false;
        }
      });
    } else {
      // Membre simple : charger seulement ses cotisations
      if (currentUser?.id) {
        this.cotisationService.getMesCotisations(currentUser.id).subscribe({
          next: (cotisations: Cotisation[]) => {
            // Trier par date de paiement décroissante (plus récent en premier)
            cotisations.sort((a, b) => {
              const dateA = a.datePaiement ? new Date(a.datePaiement).getTime() : 0;
              const dateB = b.datePaiement ? new Date(b.datePaiement).getTime() : 0;
              if (dateB !== dateA) return dateB - dateA;
              return (b.id || 0) - (a.id || 0);
            });
            
            // Appliquer les filtres côté frontend
            let filtered = [...cotisations];
            
            if (this.filterPeriode) {
              filtered = filtered.filter(c => 
                (c.periodes?.includes(this.filterPeriode) || c.periode?.includes(this.filterPeriode))
              );
            }
            if (this.filterStatut) {
              filtered = filtered.filter(c => c.statut === this.filterStatut);
            }
            if (this.filterMode) {
              filtered = filtered.filter(c => c.modePaiement === this.filterMode);
            }
            
            // Pagination
            const start = this.currentPage * this.pageSize;
            const end = start + this.pageSize;
            this.cotisations = filtered.slice(start, end);
            this.totalPages = Math.ceil(filtered.length / this.pageSize);
            this.totalElements = filtered.length;
            this.loading = false;
          },
          error: (err) => {
            this.error = 'Erreur lors du chargement: ' + (err.error?.message || err.message);
            this.loading = false;
          }
        });
      } else {
        this.error = 'Utilisateur non connecté';
        this.loading = false;
      }
    }
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadCotisations();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadCotisations();
  }

  async valider(cotisation: Cotisation): Promise<void> {
    // Ancienne méthode - gardée pour compatibilité
    if (await this.dialog.confirm({ titre: 'Confirmation', message: `Marquer la cotisation de ${cotisation.membreNom || 'Membre #' + cotisation.membreId} comme payée ?` })) {
      this.cotisationService.valider(cotisation.id).subscribe({
        next: () => this.loadCotisations(),
        error: (err) => this.dialog.erreur('Erreur: ' + (err.error?.message || err.message))
      });
    }
  }

  async validerCotisation(cotisation: Cotisation): Promise<void> {
    // Nouvelle méthode pour trésorier avec l'ID du trésorier
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.dialog.erreur('Erreur: Utilisateur non connecté');
      return;
    }

    if (await this.dialog.confirm({ titre: 'Confirmation', message: `Valider la cotisation de ${cotisation.membreNom || 'Membre #' + cotisation.membreId} pour ${this.formatPeriodes(cotisation.periodes, cotisation.periode)} ?` })) {
      this.cotisationService.validerCotisation(cotisation.id, currentUser.id).subscribe({
        next: () => {
          this.dialog.succes('Cotisation validée avec succès');
          this.loadCotisations();
          if (this.showDetailsModal) {
            this.closeDetailsModal();
          }
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de la validation: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  showRejetModal(cotisation: Cotisation): void {
    this.selectedCotisationForRejet = cotisation;
    this.motifRejet = '';
    this.showRejetModalFlag = true;
  }

  closeRejetModal(): void {
    this.showRejetModalFlag = false;
    this.selectedCotisationForRejet = null;
    this.motifRejet = '';
  }

  confirmRejet(): void {
    if (!this.selectedCotisationForRejet || !this.motifRejet || this.motifRejet.trim() === '') {
      this.dialog.erreur('Veuillez saisir un motif de rejet');
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.dialog.erreur('Erreur: Utilisateur non connecté');
      return;
    }

    this.cotisationService.rejeterCotisation(
      this.selectedCotisationForRejet.id, 
      currentUser.id, 
      this.motifRejet.trim()
    ).subscribe({
      next: (cotisationRejetee) => {
        // Mettre à jour la cotisation dans la liste si elle existe déjà
        const index = this.cotisations.findIndex(c => c.id === cotisationRejetee.id);
        if (index !== -1) {
          // Normaliser le statut
          cotisationRejetee.statut = (cotisationRejetee.statut as StatutCotisation) || StatutCotisation.REJETE;
          this.cotisations[index] = cotisationRejetee;
        }
        
        this.dialog.succes('Cotisation rejetée avec succès');
        this.closeRejetModal();
        // Réinitialiser le filtre pour voir toutes les cotisations y compris les rejetées
        this.filterStatut = '';
        this.currentPage = 0;
        // Recharger pour s'assurer que tout est à jour
        this.loadCotisations();
        if (this.showDetailsModal) {
          this.closeDetailsModal();
        }
      },
      error: (err) => {
        this.dialog.erreur('Erreur lors du rejet: ' + (err.error?.message || err.message));
      }
    });
  }

  async annuler(cotisation: Cotisation): Promise<void> {
    // Ancienne méthode - gardée pour compatibilité
    const motif = await this.dialog.prompt({ titre: 'Motif', message: 'Motif de l\'annulation:', label: 'Motif', requis: true });
    if (motif) {
      this.cotisationService.rejeter(cotisation.id, motif).subscribe({
        next: () => this.loadCotisations(),
        error: (err) => this.dialog.erreur('Erreur: ' + (err.error?.message || err.message))
      });
    }
  }

  viewDetails(cotisation: Cotisation): void {
    this.cotisationService.getById(cotisation.id).subscribe({
      next: (cot) => {
        this.selectedCotisation = cot;
        this.showDetailsModal = true;
      },
      error: (err) => this.dialog.erreur('Erreur: ' + (err.error?.message || err.message))
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedCotisation = null;
  }

  voirPreuve(cotisation: Cotisation): void {
    this.selectedCotisationForPreuve = cotisation;
    this.showPreuveModalFlag = true;
    // L'image n'est pas dans les listes : elle se charge à l'ouverture
    if (!cotisation.photoPreuve && cotisation.aPreuve) {
      this.preuves.charger('cotisations', cotisation.id).subscribe({
        next: (data) => { cotisation.photoPreuve = data; },
        error: () => { this.dialog.erreur('Impossible de charger la preuve de paiement.'); }
      });
    }
  }

  closePreuveModal(): void {
    this.showPreuveModalFlag = false;
    this.selectedCotisationForPreuve = null;
  }

  getStatut(statut: StatutCotisation): string {
    const labels: Record<StatutCotisation, string> = {
      [StatutCotisation.EN_ATTENTE]: 'En attente',
      [StatutCotisation.PAYE]: 'Payé',
      [StatutCotisation.PARTIEL]: 'Partiel',
      [StatutCotisation.EN_RETARD]: 'En retard',
      [StatutCotisation.REJETE]: 'Rejeté'
    };
    return labels[statut] || statut;
  }

  getMode(mode?: ModePaiement): string {
    if (!mode) return '-';
    const labels: Record<ModePaiement, string> = {
      [ModePaiement.ESPECES]: 'Espèces',
      [ModePaiement.MOBILE_MONEY]: 'Mobile Money'
    };
    return labels[mode] || mode;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount);
  }

  /**
   * Formate l'affichage des périodes de cotisation
   * Si plusieurs mois: affiche une plage (ex: "Janvier 2026 - Décembre 2026 (12 mois)")
   * Si un seul mois: affiche le mois (ex: "Janvier 2026")
   */
  formatPeriodes(periodes: string | undefined, periode: string | undefined): string {
    const periodesStr = periodes || periode;
    if (!periodesStr) return '-';

    // Si c'est une liste de périodes séparées par des virgules
    if (periodesStr.includes(',')) {
      const periodArray = periodesStr.split(',').map(p => p.trim()).filter(p => p);

      if (periodArray.length === 0) return '-';
      if (periodArray.length === 1) return this.formatSinglePeriod(periodArray[0]);

      // Plusieurs périodes: afficher comme plage
      const firstPeriod = periodArray[0];
      const lastPeriod = periodArray[periodArray.length - 1];
      const count = periodArray.length;

      return `${this.formatSinglePeriod(firstPeriod)} - ${this.formatSinglePeriod(lastPeriod)} (${count} mois)`;
    }

    // Sinon, c'est une seule période
    return this.formatSinglePeriod(periodesStr);
  }

  /**
   * Formate une seule période (ex: "2026-08" devient "Août 2026")
   */
  private formatSinglePeriod(period: string): string {
    if (!period || !period.includes('-')) return period;

    const [year, month] = period.split('-');
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]} ${year}`;
    }

    return period;
  }
}
