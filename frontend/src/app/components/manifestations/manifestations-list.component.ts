import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ManifestationService } from '../../services/manifestation.service';
import { Manifestation, ManifStatut } from '../../models/manifestation.model';
import { PageResponse } from '../../models/common.model';
import { MembreService } from '../../services/membre.service';
import { Membre } from '../../models/membre.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-manifestations-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <!-- Content Header -->
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-6">
            <h3 class="mb-0">Gestion des Manifestations</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end">
              <li class="breadcrumb-item"><a [routerLink]="['/dashboard']">Accueil</a></li>
              <li class="breadcrumb-item active">Manifestations</li>
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
                <i class="bi bi-calendar-event-fill"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">Total</span>
                <span class="info-box-number">{{ totalElements }}</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <div class="info-box">
              <span class="info-box-icon text-bg-warning shadow-sm">
                <i class="bi bi-calendar-plus"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">Planifiées</span>
                <span class="info-box-number">{{ statsPlanifiees }}</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <div class="info-box">
              <span class="info-box-icon text-bg-success shadow-sm">
                <i class="bi bi-calendar-check-fill"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">Réalisées</span>
                <span class="info-box-number">{{ statsRealisees }}</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <div class="info-box">
              <span class="info-box-icon text-bg-danger shadow-sm">
                <i class="bi bi-calendar-x-fill"></i>
              </span>
              <div class="info-box-content">
                <span class="info-box-text">Annulées</span>
                <span class="info-box-number">{{ statsAnnulees }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Filters Card -->
        <div class="card mb-4">
          <div class="card-header">
            <h3 class="card-title"><i class="bi bi-funnel me-2"></i>Filtres</h3>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <select class="form-select" [(ngModel)]="filterStatut" (change)="onFilterChange()">
                  <option value="">Tous les statuts</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="PLANIFIEE">Planifiée</option>
                  <option value="REALISEE">Réalisée</option>
                  <option value="ANNULEE">Annulée</option>
                </select>
              </div>
              <div class="col-md-4">
                <input
                  type="date"
                  class="form-control"
                  [(ngModel)]="filterDateDebut"
                  (change)="onFilterChange()"
                  placeholder="Date début"
                />
              </div>
              <div class="col-md-4">
                <input
                  type="date"
                  class="form-control"
                  [(ngModel)]="filterDateFin"
                  (change)="onFilterChange()"
                  placeholder="Date fin"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Manifestations Table Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Liste des Manifestations</h3>
            <div class="card-tools">
              <button class="btn btn-primary btn-sm" (click)="showFormModal()">
                <i class="bi bi-plus-circle me-1"></i> Nouvelle Manifestation
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div *ngIf="loading" class="card-body text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3">Chargement...</p>
          </div>

          <!-- Error State -->
          <div *ngIf="error" class="card-body">
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
            </div>
          </div>

          <!-- Table -->
          <div *ngIf="!loading && !error" class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-striped table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Libellé</th>
                    <th>Date</th>
                    <th>Lieu</th>
                    <th>Organisateur</th>
                    <th title="Sommes sorties de la caisse pour cette activité">Versé</th>
                    <th>Statut</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let manifestation of manifestations">
                    <td><strong>{{ manifestation.libelle }}</strong></td>
                    <td>{{ formatDate(manifestation.date) }}</td>
                    <td>{{ manifestation.lieu || '-' }}</td>
                    <td>{{ getMembreFullName(manifestation) }}</td>
                    <td>{{ formatMoney(manifestation.montantDepense) }} FCFA</td>
                    <td>
                      <span class="badge"
                        [class.text-bg-secondary]="manifestation.statut === 'EN_ATTENTE'"
                        [class.text-bg-warning]="manifestation.statut === 'PLANIFIEE'"
                        [class.text-bg-success]="manifestation.statut === 'REALISEE'"
                        [class.text-bg-danger]="manifestation.statut === 'ANNULEE'">
                        {{ getStatut(manifestation.statut) }}
                      </span>
                      <span *ngIf="manifestation.moisImpayesMembre && manifestation.moisImpayesMembre > 0"
                            class="badge text-bg-danger ms-1" title="Cotisations impayées du bénéficiaire (information pour la décision)">
                        {{ manifestation.moisImpayesMembre }} mois impayé(s)
                      </span>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm" role="group">
                        <button *ngIf="canValider(manifestation)"
                                class="btn btn-outline-info" (click)="showValidationModal(manifestation)" title="Valider (Trésorier)">
                          <i class="bi bi-check"></i>
                        </button>
                        <button *ngIf="canCloturer(manifestation)"
                                class="btn btn-outline-success" (click)="showClotureModal(manifestation)" title="Clôturer (Trésorier)">
                          <i class="bi bi-lock"></i>
                        </button>
                        <a *ngIf="canPayer(manifestation)" class="btn btn-outline-warning"
                           [routerLink]="['/operations']" [queryParams]="{ payer: manifestation.id }"
                           title="Enregistrer le paiement de cette activité (Trésorier)">
                          <i class="bi bi-cash-coin"></i>
                        </a>
                        <button *ngIf="canAnnuler(manifestation)"
                                class="btn btn-outline-danger" (click)="showAnnulationModal(manifestation)" title="Annuler (Membre)">
                          <i class="bi bi-x"></i>
                        </button>
                        <button class="btn btn-outline-primary" (click)="showDetailsModal(manifestation)" title="Détails">
                          <i class="bi bi-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr *ngIf="manifestations.length === 0">
                    <td colspan="7" class="text-center py-4">
                      <i class="bi bi-inbox display-4 text-muted"></i>
                      <p class="text-muted mt-2">Aucune manifestation trouvée</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div *ngIf="!loading && totalPages > 1" class="card-footer clearfix">
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
              <small class="text-muted">Total: {{ totalElements }} manifestations</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal - Bootstrap Modal -->
    <div *ngIf="showCreateForm" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Nouvelle Manifestation</h5>
            <button type="button" class="btn-close" (click)="closeModal()"></button>
          </div>

          <div class="modal-body" *ngIf="!loadingData">
            <form (ngSubmit)="onSubmit($event); $event.preventDefault()">
              <div class="mb-3">
                <label class="form-label">Type d'activité <span class="text-danger">*</span></label>
                <select
                  class="form-select"
                  [(ngModel)]="formData.typeActiviteId"
                  name="typeActiviteId"
                  required
                  [class.is-invalid]="formError && !formData.typeActiviteId"
                  (change)="onTypeActiviteChange()">
                  <option [value]="null">Sélectionner un type d'activité</option>
                  <option *ngFor="let t of typeActivites" [value]="t.id">
                    {{ getTypeActiviteLabel(t) }}
                  </option>
                </select>
                <div *ngIf="formError && !formData.typeActiviteId" class="invalid-feedback d-block">
                  Veuillez sélectionner un type d'activité
                </div>
                <small class="form-text text-muted d-block mt-2" *ngIf="formData.typeActiviteId && getSelectedTypeActivite()">
                  <span *ngIf="getSelectedTypeActivite()?.type">
                    <strong>Catégorie:</strong> {{ getSelectedTypeActivite()?.type }}
                  </span>
                  <span *ngIf="getSelectedTypeActivite()?.montantAlloue" class="ms-3">
                    <strong>Montant alloué:</strong> {{ formatMoney(getSelectedTypeActivite()?.montantAlloue) }} FCFA
                  </span>
                  <span *ngIf="getSelectedTypeActivite()?.lieu" class="ms-3">
                    <strong>Lieu:</strong> {{ getSelectedTypeActivite()?.lieu }}
                  </span>
                </small>
                <div *ngIf="typeActivites.length === 0 && !loadingData" class="alert alert-warning mt-2 py-2">
                  <small>Aucun type d'activité disponible. Veuillez en créer un dans les paramètres.</small>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Libellé <span class="text-danger">*</span></label>
                  <input
                    type="text"
                    class="form-control"
                    [(ngModel)]="formData.libelle"
                    name="libelle"
                    maxlength="200"
                    required
                    [class.is-invalid]="formError && !formData.libelle" />
                </div>

                <div class="col-md-6 mb-3">
                  <label class="form-label">Date <span class="text-danger">*</span></label>
                  <input
                    type="date"
                    class="form-control"
                    [(ngModel)]="formData.date"
                    name="date"
                    required
                    [class.is-invalid]="formError && !formData.date" />
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Lieu</label>
                  <input
                    type="text"
                    class="form-control"
                    [(ngModel)]="formData.lieu"
                    name="lieu"
                    maxlength="255" />
                </div>

                <div class="col-md-6 mb-3">
                  <label class="form-label">Organisateur (Membre) <span class="text-danger">*</span></label>
                  <select
                    class="form-select"
                    [(ngModel)]="formData.membreId"
                    name="membreId"
                    required
                    [disabled]="membres.length === 1"
                    [class.is-invalid]="formError && !formData.membreId">
                    <option *ngFor="let m of membres" [value]="m.id">
                      {{ m.firstName }} {{ m.lastName }}
                    </option>
                  </select>
                  <small class="form-text text-muted" *ngIf="membres.length === 1">
                    Vous êtes automatiquement sélectionné comme organisateur
                  </small>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea
                  class="form-control"
                  [(ngModel)]="formData.description"
                  name="description"
                  rows="3"
                  maxlength="2000"></textarea>
              </div>

              <div *ngIf="formError" class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>{{ formError }}
              </div>

              <div class="modal-footer px-0 pb-0">
                <button type="button" class="btn btn-secondary" (click)="closeModal()">
                  <i class="bi bi-x-circle me-1"></i>Annuler
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="saving || !isFormValid()">
                  <span *ngIf="!saving"><i class="bi bi-save me-1"></i>Enregistrer</span>
                  <span *ngIf="saving">
                    <span class="spinner-border spinner-border-sm me-2"></span>Enregistrement...
                  </span>
                </button>
              </div>
            </form>
          </div>

          <div class="modal-body text-center py-5" *ngIf="loadingData">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3">Chargement...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmation de Validation -->
    <div *ngIf="showValidationConfirm" class="modal-overlay" (click)="closeValidationModal()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header bg-info text-white">
            <h5 class="modal-title"><i class="bi bi-check-circle me-2"></i>Valider la Manifestation</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeValidationModal()"></button>
          </div>
          <div class="modal-body">
            <p>Voulez-vous valider la manifestation <strong>"{{ selectedManifestation?.libelle }}"</strong> ?</p>
            <p class="text-muted mb-0">Elle sera planifiée et notifiée à tous les membres.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeValidationModal()">Annuler</button>
            <button type="button" class="btn btn-info" (click)="confirmValidation()" [disabled]="processing">
              <span *ngIf="!processing"><i class="bi bi-check me-1"></i>Valider</span>
              <span *ngIf="processing">
                <span class="spinner-border spinner-border-sm me-2"></span>Traitement...
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmation d'Annulation -->
    <div *ngIf="showAnnulationConfirm" class="modal-overlay" (click)="closeAnnulationModal()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title"><i class="bi bi-x-circle me-2"></i>Annuler la Manifestation</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeAnnulationModal()"></button>
          </div>
          <div class="modal-body">
            <p>Voulez-vous annuler la manifestation <strong>"{{ selectedManifestation?.libelle }}"</strong> ?</p>
            <p class="text-muted mb-0">Tous les membres seront notifiés de l'annulation.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeAnnulationModal()">Non</button>
            <button type="button" class="btn btn-danger" (click)="confirmAnnulation()" [disabled]="processing">
              <span *ngIf="!processing"><i class="bi bi-x me-1"></i>Oui, annuler</span>
              <span *ngIf="processing">
                <span class="spinner-border spinner-border-sm me-2"></span>Traitement...
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Clôture -->
    <div *ngIf="showClotureForm" class="modal-overlay" (click)="closeClotureModal()">
      <div class="modal-container modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title"><i class="bi bi-lock me-2"></i>Clôturer la Manifestation</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeClotureModal()"></button>
          </div>
          <div class="modal-body">
            <p class="mb-3">Clôturer la manifestation <strong>"{{ selectedManifestation?.libelle }}"</strong></p>
            <form (ngSubmit)="confirmCloture($event); $event.preventDefault()">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Montant prévu (FCFA) <span class="text-danger">*</span></label>
                  <input
                    type="number"
                    class="form-control"
                    [(ngModel)]="clotureData.montantPrevu"
                    name="montantPrevu"
                    min="0"
                    step="0.01"
                    required
                    [class.is-invalid]="clotureError && !clotureData.montantPrevu" />
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Montant réellement dépensé (FCFA) <span class="text-danger">*</span></label>
                  <input
                    type="number"
                    class="form-control"
                    [(ngModel)]="clotureData.montantReel"
                    name="montantReel"
                    min="0"
                    step="0.01"
                    required
                    [class.is-invalid]="clotureError && !clotureData.montantReel" />
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Matériaux/ressources utilisés</label>
                <textarea
                  class="form-control"
                  [(ngModel)]="clotureData.materiaux"
                  name="materiaux"
                  rows="2"
                  maxlength="2000"
                  placeholder="Décrire les matériaux ou ressources utilisés"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Remarques</label>
                <textarea
                  class="form-control"
                  [(ngModel)]="clotureData.remarques"
                  name="remarques"
                  rows="2"
                  maxlength="2000"
                  placeholder="Ajouter des remarques ou observations"></textarea>
              </div>
              <div *ngIf="clotureError" class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>{{ clotureError }}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closeClotureModal()">Annuler</button>
                <button type="submit" class="btn btn-success" [disabled]="processing || !isClotureFormValid()">
                  <span *ngIf="!processing"><i class="bi bi-lock me-1"></i>Clôturer</span>
                  <span *ngIf="processing">
                    <span class="spinner-border spinner-border-sm me-2"></span>Traitement...
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Détails -->
    <div *ngIf="showDetails" class="modal-overlay" (click)="closeDetailsModal()">
      <div class="modal-container modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title"><i class="bi bi-info-circle me-2"></i>Détails de la Manifestation</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeDetailsModal()"></button>
          </div>
          <div class="modal-body" *ngIf="selectedManifestation">
            <div class="row mb-3">
              <div class="col-md-6">
                <strong>Libellé:</strong>
                <p>{{ selectedManifestation.libelle }}</p>
              </div>
              <div class="col-md-6">
                <strong>Date:</strong>
                <p>{{ formatDate(selectedManifestation.date) }}</p>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <strong>Lieu:</strong>
                <p>{{ selectedManifestation.lieu || 'N/A' }}</p>
              </div>
              <div class="col-md-6">
                <strong>Statut:</strong>
                <p>
                  <span class="badge"
                        [class.text-bg-secondary]="selectedManifestation.statut === 'EN_ATTENTE'"
                        [class.text-bg-warning]="selectedManifestation.statut === 'PLANIFIEE'"
                        [class.text-bg-success]="selectedManifestation.statut === 'REALISEE'"
                        [class.text-bg-danger]="selectedManifestation.statut === 'ANNULEE'">
                    {{ getStatut(selectedManifestation.statut) }}
                  </span>
                </p>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <strong>Organisateur:</strong>
                <p>{{ getMembreFullName(selectedManifestation) }}</p>
              </div>
              <div class="col-md-6">
                <strong>Dépenses:</strong>
                <p>{{ formatMoney(selectedManifestation.montantDepense) }} FCFA</p>
              </div>
            </div>
            <div *ngIf="selectedManifestation.description" class="mb-3">
              <strong>Description:</strong>
              <p>{{ selectedManifestation.description }}</p>
            </div>
            <div *ngIf="selectedManifestation.montantPrevu || selectedManifestation.montantReel" class="row mb-3">
              <div class="col-md-6" *ngIf="selectedManifestation.montantPrevu">
                <strong>Montant prévu:</strong>
                <p>{{ formatMoney(selectedManifestation.montantPrevu) }} FCFA</p>
              </div>
              <div class="col-md-6" *ngIf="selectedManifestation.montantReel">
                <strong>Montant réel:</strong>
                <p>{{ formatMoney(selectedManifestation.montantReel) }} FCFA</p>
              </div>
            </div>
            <div *ngIf="selectedManifestation.materiaux" class="mb-3">
              <strong>Matériaux:</strong>
              <p>{{ selectedManifestation.materiaux }}</p>
            </div>
            <div *ngIf="selectedManifestation.remarques" class="mb-3">
              <strong>Remarques:</strong>
              <p>{{ selectedManifestation.remarques }}</p>
            </div>
            <div *ngIf="selectedManifestation.dateCloture" class="mb-3">
              <strong>Date de clôture:</strong>
              <p>{{ formatDate(selectedManifestation.dateCloture) }}</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeDetailsModal()">Fermer</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal d'Erreur -->
    <div *ngIf="showErrorModal" class="modal-overlay" (click)="closeErrorModal()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title"><i class="bi bi-exclamation-triangle me-2"></i>Erreur</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeErrorModal()"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">{{ errorMessage }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeErrorModal()">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Styles pour les info-boxes */
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

    /* Styles améliorés pour les modales */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1050;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideIn 0.3s ease-out;
      position: relative;
    }

    .modal-container.modal-lg {
      max-width: 800px;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .modal-header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding: 1.25rem 1.5rem;
      border-radius: 12px 12px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-header.bg-info {
      background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
    }

    .modal-header.bg-danger {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    }

    .modal-header.bg-success {
      background: linear-gradient(135deg, #28a745 0%, #218838 100%);
    }

    .modal-header.bg-primary {
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    }

    .modal-title {
      font-weight: 600;
      font-size: 1.1rem;
      margin: 0;
      display: flex;
      align-items: center;
    }

    .modal-body {
      padding: 1.5rem;
      flex: 1;
      overflow-y: auto;
    }

    .modal-footer {
      border-top: 1px solid #dee2e6;
      padding: 1rem 1.5rem;
      border-radius: 0 0 12px 12px;
      background-color: #f8f9fa;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      opacity: 0.9;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .btn-close:hover {
      opacity: 1;
    }

    .btn-close-white {
      filter: invert(1) grayscale(100%) brightness(200%);
      color: white;
    }

    .btn-close-white::before {
      content: '×';
      font-size: 28px;
      font-weight: 300;
    }
  `]
})
export class ManifestationsListComponent implements OnInit {
  private manifestationService = inject(ManifestationService);
  private membreService = inject(MembreService);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  manifestations: Manifestation[] = [];
  loading = false;
  error = '';
  showCreateForm = false;
  readonly ManifStatut = ManifStatut;

  filterStatut = '';
  filterDateDebut = '';
  filterDateFin = '';

  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // Stats pour les cartes résumé
  statsPlanifiees = 0;
  statsRealisees = 0;
  statsAnnulees = 0;

  // Formulaire
  formData: {
    libelle: string;
    date: string;
    lieu: string;
    description: string;
    membreId: number | null;
    typeActiviteId: number | null;
  } = {
    libelle: '',
    date: '',
    lieu: '',
    description: '',
    membreId: null,
    typeActiviteId: null
  };
  membres: Membre[] = [];
  typeActivites: any[] = [];
  loadingData = false;
  saving = false;
  formError = '';

  // Modales
  showValidationConfirm = false;
  showAnnulationConfirm = false;
  showClotureForm = false;
  showDetails = false;
  showErrorModal = false;
  selectedManifestation: Manifestation | null = null;
  processing = false;
  errorMessage = '';

  // Formulaire de clôture
  clotureData: {
    montantPrevu: number | null;
    montantReel: number | null;
    materiaux: string;
    remarques: string;
  } = {
    montantPrevu: null,
    montantReel: null,
    materiaux: '',
    remarques: ''
  };
  clotureError = '';

  ngOnInit(): void {
    this.loadManifestations();
    this.loadStats();
  }

  loadStats(): void {
    // Charger les stats par statut
    this.manifestationService.getAll({ q: '', statut: 'PLANIFIEE', page: 0, size: 1 }).subscribe({
      next: (response) => this.statsPlanifiees = response.totalElements,
      error: () => this.statsPlanifiees = 0
    });
    this.manifestationService.getAll({ q: '', statut: 'REALISEE', page: 0, size: 1 }).subscribe({
      next: (response) => this.statsRealisees = response.totalElements,
      error: () => this.statsRealisees = 0
    });
    this.manifestationService.getAll({ q: '', statut: 'ANNULEE', page: 0, size: 1 }).subscribe({
      next: (response) => this.statsAnnulees = response.totalElements,
      error: () => this.statsAnnulees = 0
    });
  }

  loadManifestations(): void {
    this.loading = true;
    this.error = '';

    this.manifestationService.getAll({
      q: '',
      statut: this.filterStatut || undefined,
      from: this.filterDateDebut || undefined,
      to: this.filterDateFin || undefined,
      page: this.currentPage,
      size: this.pageSize
    }).subscribe({
      next: (response: PageResponse<Manifestation>) => {
        this.manifestations = response.content;
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

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadManifestations();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadManifestations();
  }

  /** Trésorier peut valider/clôturer. L'admin ne fait que consulter. */
  get isTresorier(): boolean {
    return this.authService.hasRole('TRESORIER');
  }

  /** Le trésorier et l'administrateur valident ou rejettent les manifestations déclarées. */
  get peutValider(): boolean {
    return this.authService.hasAnyRole(['TRESORIER', 'ADMIN']);
  }

  /**
   * Vérifie si l'utilisateur peut valider (doit être trésorier)
   * La validation est possible seulement si la manifestation est EN_ATTENTE
   */
  canValider(manifestation: Manifestation): boolean {
    if (manifestation.statut !== ManifStatut.EN_ATTENTE) {
      return false;
    }
    return this.peutValider;
  }

  /** Le trésorier enregistre le paiement d'une activité validée : la somme sort de la caisse et apparaît dans « Versé ». */
  canPayer(manifestation: Manifestation): boolean {
    return this.isTresorier && (manifestation.statut === ManifStatut.PLANIFIEE || manifestation.statut === ManifStatut.REALISEE);
  }

  /**
   * Vérifie si l'utilisateur peut clôturer (doit être trésorier et manifestation planifiée)
   */
  canCloturer(manifestation: Manifestation): boolean {
    if (manifestation.statut !== ManifStatut.PLANIFIEE) {
      return false;
    }
    return this.isTresorier;
  }

  /**
   * Vérifie si l'utilisateur peut annuler (doit être le membre déclarant)
   * Le membre peut annuler si la manifestation est EN_ATTENTE ou PLANIFIEE
   */
  canAnnuler(manifestation: Manifestation): boolean {
    if (manifestation.statut !== ManifStatut.PLANIFIEE && manifestation.statut !== ManifStatut.EN_ATTENTE) {
      return false;
    }
    const user = this.authService.getCurrentUser();
    return !!(user && user.id === manifestation.membreId);
  }

  /**
   * Affiche la modale de confirmation de validation
   */
  showValidationModal(manifestation: Manifestation): void {
    this.selectedManifestation = manifestation;
    this.showValidationConfirm = true;
  }

  closeValidationModal(): void {
    this.showValidationConfirm = false;
    this.selectedManifestation = null;
  }

  confirmValidation(): void {
    if (!this.selectedManifestation) return;
    
    this.processing = true;
    this.manifestationService.valider(this.selectedManifestation.id).subscribe({
      next: () => {
        this.processing = false;
        this.closeValidationModal();
        this.loadManifestations();
      },
      error: (err: any) => {
        this.processing = false;
        this.showError('Erreur lors de la validation: ' + (err.error?.message || err.message));
      }
    });
  }

  /**
   * Affiche la modale de confirmation d'annulation
   */
  showAnnulationModal(manifestation: Manifestation): void {
    this.selectedManifestation = manifestation;
    this.showAnnulationConfirm = true;
  }

  closeAnnulationModal(): void {
    this.showAnnulationConfirm = false;
    this.selectedManifestation = null;
  }

  confirmAnnulation(): void {
    if (!this.selectedManifestation) return;
    
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      this.showError('Vous devez être connecté pour annuler une manifestation');
      return;
    }

    this.processing = true;
    this.manifestationService.annulerParMembre(this.selectedManifestation.id, user.id).subscribe({
      next: () => {
        this.processing = false;
        this.closeAnnulationModal();
        this.loadManifestations();
      },
      error: (err: any) => {
        this.processing = false;
        this.showError('Erreur lors de l\'annulation: ' + (err.error?.message || err.message));
      }
    });
  }

  /**
   * Affiche la modale de clôture
   */
  showClotureModal(manifestation: Manifestation): void {
    this.selectedManifestation = manifestation;
    this.clotureData = {
      montantPrevu: null,
      montantReel: null,
      materiaux: '',
      remarques: ''
    };
    this.clotureError = '';
    this.showClotureForm = true;
  }

  closeClotureModal(): void {
    this.showClotureForm = false;
    this.selectedManifestation = null;
    this.clotureError = '';
  }

  isClotureFormValid(): boolean {
    return !!(this.clotureData.montantPrevu && this.clotureData.montantReel);
  }

  confirmCloture(event: Event): void {
    event.preventDefault();
    if (!this.selectedManifestation) return;

    if (!this.isClotureFormValid()) {
      this.clotureError = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      this.showError('Vous devez être connecté pour clôturer une manifestation');
      return;
    }

    this.processing = true;
    this.clotureError = '';
    
    this.manifestationService.cloturer(
      this.selectedManifestation.id,
      user.id,
      this.clotureData.montantPrevu!,
      this.clotureData.montantReel!,
      this.clotureData.materiaux || undefined,
      this.clotureData.remarques || undefined
    ).subscribe({
      next: () => {
        this.processing = false;
        this.closeClotureModal();
        this.loadManifestations();
      },
      error: (err: any) => {
        this.processing = false;
        this.clotureError = 'Erreur lors de la clôture: ' + (err.error?.message || err.message);
      }
    });
  }

  /**
   * Affiche la modale de détails
   */
  showDetailsModal(manifestation: Manifestation): void {
    this.selectedManifestation = manifestation;
    this.showDetails = true;
  }

  closeDetailsModal(): void {
    this.showDetails = false;
    this.selectedManifestation = null;
  }

  /**
   * Affiche une modale d'erreur
   */
  showError(message: string): void {
    this.errorMessage = message;
    this.showErrorModal = true;
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  getStatut(statut: ManifStatut): string {
    const labels: Record<ManifStatut, string> = {
      [ManifStatut.EN_ATTENTE]: 'En attente',
      [ManifStatut.PLANIFIEE]: 'Planifiée',
      [ManifStatut.REALISEE]: 'Réalisée',
      [ManifStatut.ANNULEE]: 'Annulée'
    };
    return labels[statut] || statut;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount);
  }

  getMembreFullName(manifestation: Manifestation): string {
    if (manifestation.membreNom || manifestation.membrePrenom) {
      const parts = [];
      if (manifestation.membrePrenom) parts.push(manifestation.membrePrenom);
      if (manifestation.membreNom) parts.push(manifestation.membreNom);
      return parts.join(' ') || 'N/A';
    }
    return 'N/A';
  }

  getTypeActiviteLabel(typeActivite: any): string {
    if (!typeActivite) return '';
    let label = typeActivite.libelle || '';
    if (typeActivite.montantAlloue) {
      label += ' — ' + new Intl.NumberFormat('fr-FR').format(typeActivite.montantAlloue).replace(/\u202f|\u00a0/g, ' ') + ' FCFA';
    }
    return label;
  }

  getSelectedTypeActivite(): any {
    if (!this.formData.typeActiviteId || !this.typeActivites || this.typeActivites.length === 0) return null;
    return this.typeActivites.find(t => Number(t.id) === Number(this.formData.typeActiviteId));
  }

  onTypeActiviteChange(): void {
    const t: any = this.getSelectedTypeActivite();
    if (t) {
      if (!this.formData.libelle) this.formData.libelle = t.sousType && !t.libelle.includes(t.sousType) ? t.libelle + ' : ' + t.sousType : t.libelle;
      if (!this.formData.lieu && t.lieu && !/^(n\/a|variable|à définir)$/i.test(t.lieu)) this.formData.lieu = t.lieu;
    }
    // Réinitialiser l'erreur quand l'utilisateur sélectionne un type
    if (this.formData.typeActiviteId) {
      this.formError = '';
    }
  }

  showFormModal(): void {
    this.showCreateForm = true;
    this.formError = '';
    this.formData = {
      libelle: '',
      date: '',
      lieu: '',
      description: '',
      membreId: null,
      typeActiviteId: null
    };
    this.loadFormData();
  }

  closeModal(): void {
    this.showCreateForm = false;
    this.formError = '';
    this.saving = false;
  }

  loadFormData(): void {
    this.loadingData = true;
    
    // Récupérer l'ID du membre connecté
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.id;
    
    if (!currentUserId) {
      this.formError = 'Vous devez être connecté pour créer une manifestation';
      this.loadingData = false;
      return;
    }
    
    // Charger uniquement le membre connecté
    this.membreService.getById(currentUserId).subscribe({
      next: (membre) => {
        this.membres = [membre];
        // Pré-sélectionner le membre connecté
        this.formData.membreId = membre.id;
        
        // Charger les types d'activité
        const apiUrl = `${environment.apiUrl}/types-activite`;
        this.http.get<any[]>(apiUrl).subscribe({
          next: (types) => {
            // Trier les types d'activité par type (catégorie) puis par libellé
            this.typeActivites = types.sort((a, b) => {
              if (a.type !== b.type) {
                return (a.type || '').localeCompare(b.type || '');
              }
              return (a.libelle || '').localeCompare(b.libelle || '');
            });
            this.loadingData = false;
          },
          error: (err) => {
            console.error('Erreur chargement types:', err);
            this.formError = 'Erreur lors du chargement des types d\'activité. Veuillez réessayer.';
            this.loadingData = false;
          }
        });
      },
      error: (err) => {
        console.error('Erreur chargement membre:', err);
        this.formError = 'Erreur lors du chargement de votre profil. Veuillez réessayer.';
        this.loadingData = false;
      }
    });
  }

  isFormValid(): boolean {
    return !!(
      this.formData.libelle?.trim() &&
      this.formData.date &&
      this.formData.membreId &&
      this.formData.typeActiviteId
    );
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.formError = '';

    if (!this.isFormValid()) {
      this.formError = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    this.saving = true;
    this.manifestationService.create({
      libelle: this.formData.libelle,
      date: this.formData.date,
      lieu: this.formData.lieu || undefined,
      description: this.formData.description || undefined,
      membreId: Number(this.formData.membreId),
      typeActiviteId: Number(this.formData.typeActiviteId)
    }).subscribe({
      next: (createdManifestation) => {
        this.saving = false;
        // Fermer le modal d'abord
        this.closeModal();
        // Réinitialiser à la première page pour voir la nouvelle manifestation
        this.currentPage = 0;
        // Recharger la liste immédiatement
        this.loadManifestations();
      },
      error: (err) => {
        this.saving = false;
        this.formError = 'Erreur lors de la création: ' + (err.error?.message || err.message || 'Erreur inconnue');
        console.error('Erreur création manifestation:', err);
      }
    });
  }
}
