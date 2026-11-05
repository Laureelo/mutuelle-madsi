import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PretService } from '../../services/pret.service';
import { Pret, StatutPret, PretCreate } from '../../models/pret.model';
import { PageResponse } from '../../models/common.model';
import { MembreService } from '../../services/membre.service';
import { AuthService } from '../../services/auth.service';
import { Membre } from '../../models/membre.model';
import { RemboursementService } from '../../services/remboursement.service';
import { Echeance, RemboursementPret, RemboursementCreate, EchStatut } from '../../models/echeance.model';
import { PreuveService } from '../../services/preuve.service';
import { compresserImage } from '../../utils/image';
import { RecuService } from '../../services/recu.service';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-prets-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Gestion des Prêts</h1>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="showFormModal()">
            <i class="bi bi-plus-circle"></i>
            Demander un Prêt
          </button>
        </div>
      </div>

      <!-- Cartes Résumé -->
      <div class="stats-row" *ngIf="isTresorierOrAdmin">
        <div class="stat-card">
          <div class="stat-icon bg-info">
            <i class="bi bi-credit-card-fill"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ totalElements }}</span>
            <span class="stat-label">Total Prêts</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-warning">
            <i class="bi bi-hourglass-split"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ statsPretsEnAttente }}</span>
            <span class="stat-label">En Attente</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-primary">
            <i class="bi bi-arrow-repeat"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ statsPretsEnCours }}</span>
            <span class="stat-label">En Cours</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-success">
            <i class="bi bi-check-circle-fill"></i>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ statsPretsClotures }}</span>
            <span class="stat-label">Clôturés</span>
          </div>
        </div>
      </div>

      <div class="filters-section">
        <div class="filter-row">
          <select class="form-control" [(ngModel)]="filterStatut" (change)="onFilterChange()">
            <option value="">Tous les statuts</option>
            <option value="DEMANDE">En attente</option>
            <option value="APPROUVE">Approuvé</option>
            <option value="REFUSE">Rejeté</option>
            <option value="EN_COURS">En cours</option>
            <option value="CLOTURE">Clôturé</option>
          </select>
          <div class="info-message" *ngIf="!isTresorierOrAdmin">
            <i class="fas fa-info-circle"></i>
            Vous visualisez uniquement vos propres prêts
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="loading-state"><div class="spinner"></div><p>Chargement...</p></div>
      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>

      <div *ngIf="!loading && !error" class="table-container">
        <table class="data-table">
          <thead>
            <tr><th>Membre</th><th>Montant</th><th>Période</th><th>Reste à payer</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let pret of prets">
              <td>{{ pret.membrePrenom }} {{ pret.membreNom }}</td>
              <td>{{ formatMoney(pret.montant) }} FCFA</td>
              <td>{{ pret.duree }} {{ getPeriodeUniteLabel(pret.periodeUnite) }}</td>
              <td><strong>{{ formatMoney(pret.montantRestant) }} FCFA</strong></td>
              <td><span class="badge" [class]="'badge-' + pret.statut">{{ getStatut(pret.statut) }}</span></td>
              <td>
                <div class="action-buttons">
                  <!-- Actions de gestion : réservées au trésorier uniquement -->
                  <span *ngIf="pret.moisImpayesMembre && pret.moisImpayesMembre > 0" class="badge text-bg-danger me-1"
                        title="Cotisations impayées du demandeur (information pour la décision)">
                    <i class="fas fa-exclamation-circle"></i> {{ pret.moisImpayesMembre }} mois impayé(s)
                  </span>
                  <span *ngIf="pret.confirmationRequise" class="badge text-bg-warning me-1"
                        title="Prêt supérieur au seuil : le président (administrateur) doit le confirmer avant la validation du trésorier">
                    <i class="fas fa-user-shield"></i> À confirmer
                  </span>
                  <span *ngIf="pret.confirme && pret.statut === StatutPret.DEMANDE" class="badge text-bg-success me-1" title="Confirmé par le président">
                    <i class="fas fa-user-check"></i> Confirmé
                  </span>
                  <button *ngIf="isAdmin && pret.confirmationRequise" class="btn-icon btn-success" (click)="confirmerPret(pret)" title="Confirmer ce prêt (président)">
                    <i class="fas fa-user-check"></i>
                  </button>
                  <button *ngIf="isTresorier && pret.statut === StatutPret.DEMANDE && !pret.confirmationRequise" class="btn-icon btn-success" (click)="approuver(pret)" title="Approuver"><i class="fas fa-check"></i></button>
                  <button *ngIf="isTresorier && pret.statut === StatutPret.DEMANDE" class="btn-icon btn-danger" (click)="showRejectModalFn(pret)" title="Rejeter"><i class="fas fa-times"></i></button>
                  <button *ngIf="isTresorier && pret.statut === StatutPret.APPROUVE" class="btn-icon btn-success" (click)="showVerserModal(pret)" title="Décaisser"><i class="fas fa-hand-holding-usd"></i></button>
                  <!-- Remboursement : accessible à tous pour les prêts en cours -->
                  <button
                    *ngIf="pret.statut === StatutPret.EN_COURS"
                    class="btn-icon btn-primary"
                    [routerLink]="['/prets/remboursement', pret.id]"
                    title="Rembourser">
                    <i class="bi bi-cash-coin"></i>
                  </button>
                  <!-- Remboursement trésorier (ancien système) -->
                  <button *ngIf="isTresorier && pret.statut === StatutPret.EN_COURS" class="btn-icon" (click)="addRemboursement(pret)" title="Remboursement (Trésorier)"><i class="fas fa-money-bill-wave"></i></button>
                  <!-- Reçu du versement : dès que le prêt a été décaissé -->
                  <button *ngIf="pret.dateDecaissement" class="btn-icon btn-success" (click)="recus.ouvrirRecuVersementPret(pret.id)" title="Reçu de versement">
                    <i class="fas fa-file-pdf"></i>
                  </button>
                  <!-- Détails : accessible à tous -->
                  <button class="btn-icon" (click)="viewDetails(pret)" title="Détails"><i class="bi bi-eye"></i></button>
                </div>
              </td>
            </tr>
            <tr *ngIf="prets.length === 0"><td colspan="6" class="text-center">Aucun prêt trouvé</td></tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && totalPages > 1" class="pagination">
        <button class="btn btn-secondary" [disabled]="currentPage === 0" (click)="goToPage(currentPage - 1)">Précédent</button>
        <span>Page {{ currentPage + 1 }} sur {{ totalPages }}</span>
        <button class="btn btn-secondary" [disabled]="currentPage === totalPages - 1" (click)="goToPage(currentPage + 1)">Suivant</button>
      </div>

      <div *ngIf="showForm" class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Demander un Prêt</h2>
            <button class="btn-close" (click)="closeModal()" type="button">&times;</button>
          </div>

          <form (ngSubmit)="onSubmit($event); $event.preventDefault()">
            <div class="form-group">
              <div class="info-box">
                <i class="fas fa-info-circle"></i>
                Vous faites une demande de prêt pour vous-même. Les prêts sont accordés sans intérêt.
              </div>
            </div>
            <div class="form-group" *ngIf="situation">
              <div class="alert alert-danger mb-2" *ngIf="situation.cotisationsAJourExigees && !situation.aJour">
                <i class="fas fa-exclamation-triangle"></i>
                Vous n'êtes pas à jour de vos cotisations : {{ situation.nombreMoisImpayes }} mois impayé(s),
                soit {{ formatMoney(situation.montantImpaye) }} FCFA.
                Vous ne pourrez pas obtenir de prêt avant de régulariser.
              </div>
              <div class="alert alert-warning mb-2" *ngIf="!situation.cotisationsAJourExigees && !situation.aJour">
                <i class="fas fa-exclamation-triangle"></i>
                Vous avez {{ situation.nombreMoisImpayes }} mois de cotisation impayé(s),
                soit {{ formatMoney(situation.montantImpaye) }} FCFA.
                Votre demande reste possible, mais pensez à régulariser vos cotisations.
              </div>
              <div class="info-box mb-2" *ngIf="situation.encoursPrets > 0">
                <i class="fas fa-info-circle"></i>
                Vous devez encore {{ formatMoney(situation.encoursPrets) }} FCFA sur vos prêts en cours.
                Vous pouvez demander au plus {{ formatMoney(situation.margePretDisponible) }} FCFA de plus
                (plafond : {{ formatMoney(situation.plafondEncoursPrets) }} FCFA).
              </div>
              <div class="info-box" *ngIf="formData.montant > situation.seuilConfirmation">
                <i class="fas fa-user-shield"></i>
                Un prêt supérieur à {{ formatMoney(situation.seuilConfirmation) }} FCFA doit être confirmé par le président
                (administrateur) avant sa validation par le trésorier.
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Montant (FCFA) <span class="required">*</span></label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="formData.montant"
                  name="montant"
                  min="1"
                  step="1"
                  required
                  (ngModelChange)="onFormChange()"
                  [class.is-invalid]="formError && (!formData.montant || formData.montant <= 0)" />
              </div>

              <div class="form-group">
                <label>Période de remboursement <span class="required">*</span></label>
                <div class="periode-row">
                  <input
                    type="number"
                    class="form-control periode-input"
                    [(ngModel)]="periodeValeur"
                    name="periodeValeur"
                    min="1"
                    max="365"
                    required
                    (ngModelChange)="onPeriodeChange()"
                    [class.is-invalid]="formError && (!periodeValeur || periodeValeur <= 0)"
                    placeholder="Ex: 7" />
                  <select
                    class="form-control periode-select"
                    [(ngModel)]="periodeUnite"
                    name="periodeUnite"
                    (ngModelChange)="onPeriodeChange()">
                    <option value="jour">Jour(s)</option>
                    <option value="semaine">Semaine(s)</option>
                    <option value="mois">Mois</option>
                  </select>
                </div>
                <small class="periode-info" *ngIf="periodeValeur > 0">
                  = {{ getEcheancesCount() }} échéance(s)
                </small>
              </div>
            </div>

            <div class="form-group">
              <label>Motif de la demande (facultatif)</label>
              <textarea
                class="form-control"
                [(ngModel)]="formData.motif"
                name="motif"
                rows="3"
                placeholder="Expliquez brièvement la raison de votre demande de prêt..."></textarea>
              <small class="text-muted">Ce champ est facultatif mais peut aider à traiter votre demande plus rapidement.</small>
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
        </div>
      </div>

      <!-- Modale de détails du prêt -->
      <div *ngIf="showDetailsModal && selectedPret" class="modal-overlay" (click)="closeDetailsModal()">
        <div class="modal-content modal-large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Détails du Prêt #{{ selectedPret.id }}</h2>
            <button class="btn-close" (click)="closeDetailsModal()" type="button">&times;</button>
          </div>

          <div class="details-content">
            <div class="detail-row">
              <span class="detail-label">Membre:</span>
              <span class="detail-value">{{ selectedPret.membrePrenom }} {{ selectedPret.membreNom }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Montant accordé:</span>
              <span class="detail-value">{{ formatMoney(selectedPret.montant) }} FCFA</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Période:</span>
              <span class="detail-value">{{ selectedPret.duree }} {{ getPeriodeUniteLabel(selectedPret.periodeUnite) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Montant remboursé:</span>
              <span class="detail-value">{{ formatMoney(selectedPret.montantRembourse) }} FCFA</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Reste à payer:</span>
              <span class="detail-value"><strong>{{ formatMoney(selectedPret.montantRestant) }} FCFA</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Statut:</span>
              <span class="badge" [class]="'badge-' + selectedPret.statut">{{ getStatut(selectedPret.statut) }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedPret.dateDemande">
              <span class="detail-label">Date de demande:</span>
              <span class="detail-value">{{ selectedPret.dateDemande }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedPret.dateValidation">
              <span class="detail-label">Date de validation:</span>
              <span class="detail-value">{{ selectedPret.dateValidation }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedPret.dateDecaissement">
              <span class="detail-label">Date de décaissement:</span>
              <span class="detail-value">{{ selectedPret.dateDecaissement }}</span>
            </div>

            <!-- Motif de la demande -->
            <div class="detail-row" *ngIf="selectedPret.motif">
              <span class="detail-label">Motif de la demande:</span>
              <span class="detail-value" style="font-style: italic; color: #555;">
                <i class="bi bi-chat-left-text me-2"></i>{{ selectedPret.motif }}
              </span>
            </div>

            <!-- Motif de rejet (pour prêts rejetés) -->
            <div class="detail-row" *ngIf="selectedPret.statut === StatutPret.REFUSE">
              <span class="detail-label">Motif de rejet:</span>
              <span class="detail-value" style="color: #dc3545; font-weight: 600;">
                <i class="bi bi-x-circle-fill me-2"></i>{{ selectedPret.motifRejet || 'Aucun motif spécifié' }}
              </span>
            </div>

            <!-- Preuve de paiement -->
            <div class="detail-row" *ngIf="selectedPret.aPreuve || selectedPret.photoPreuve">
              <span class="detail-label">Preuve de paiement:</span>
              <span class="detail-value">
                <img *ngIf="selectedPret.photoPreuve" [src]="selectedPret.photoPreuve" alt="Preuve de paiement" class="preuve-image" (click)="openPreuveModal(selectedPret.photoPreuve)" />
              </span>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeDetailsModal()">Fermer</button>
          </div>
        </div>
      </div>

      <!-- Modale de visualisation de la preuve -->
      <div *ngIf="showPreuveModal" class="modal-overlay preuve-overlay" (click)="closePreuveModal()">
        <div class="preuve-modal-content" (click)="$event.stopPropagation()">
          <button class="btn-close preuve-close" (click)="closePreuveModal()" type="button">&times;</button>
          <img [src]="currentPreuveImage" alt="Preuve de paiement" class="preuve-fullsize" />
        </div>
      </div>

      <!-- Modale de rejet -->
      <div *ngIf="showRejectModal && selectedPret" class="modal-overlay" (click)="closeRejectModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Rejeter le Prêt</h2>
            <button class="btn-close" (click)="closeRejectModal()" type="button">&times;</button>
          </div>

          <div class="form-group" style="padding: 30px;">
            <p>Êtes-vous sûr de vouloir rejeter le prêt de <strong>{{ formatMoney(selectedPret.montant) }} FCFA</strong> pour <strong>{{ selectedPret.membrePrenom }} {{ selectedPret.membreNom }}</strong> ?</p>

            <label>Motif du rejet (optionnel):</label>
            <textarea
              class="form-control"
              [(ngModel)]="rejectMotif"
              rows="3"
              placeholder="Entrez le motif du rejet..."></textarea>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeRejectModal()">Annuler</button>
            <button type="button" class="btn btn-danger" (click)="rejeter()">Rejeter</button>
          </div>
        </div>
      </div>

      <!-- Modale de décaissement -->
      <div *ngIf="showVerserModalState && selectedPret" class="modal-overlay" (click)="closeVerserModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Décaisser le Prêt</h2>
            <button class="btn-close" (click)="closeVerserModal()" type="button">&times;</button>
          </div>

          <div style="padding: 30px;">
            <div class="info-box" style="margin-bottom: 20px;">
              <div>
                <strong>{{ selectedPret.membrePrenom }} {{ selectedPret.membreNom }}</strong> -
                Montant à verser: <strong>{{ formatMoney(selectedPret.montant) }} FCFA</strong>
              </div>
            </div>

            <div class="form-group">
              <label>Mode de paiement <span class="required">*</span></label>
              <select class="form-control" [(ngModel)]="verserData.modePaiement">
                <option value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>

            <div class="form-group">
              <label>Date de décaissement <span class="required">*</span></label>
              <input
                type="date"
                class="form-control"
                [(ngModel)]="verserData.dateDecaissement"
                required />
            </div>

            <div class="form-group">
              <label>Référence / Numéro de transaction</label>
              <input
                type="text"
                class="form-control"
                [(ngModel)]="verserData.reference"
                placeholder="Optionnel" />
            </div>

            <div class="form-group">
              <label>Preuve de paiement (photo)</label>
              <input
                type="file"
                class="form-control"
                accept="image/*"
                (change)="onVerserPhotoChange($event)" />
              <div *ngIf="verserPhotoPreview" class="photo-preview">
                <img [src]="verserPhotoPreview" alt="Aperçu" />
                <button type="button" class="btn-remove-photo" (click)="removeVerserPhoto()">&times;</button>
              </div>
            </div>

            <div *ngIf="verserError" class="alert alert-danger">{{ verserError }}</div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeVerserModal()">Annuler</button>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="savingVerser"
              (click)="submitVerser()">
              <span *ngIf="savingVerser">Traitement...</span>
              <span *ngIf="!savingVerser">Décaisser</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Modale de remboursement -->
      <div *ngIf="showRemboursementModal && selectedPret" class="modal-overlay" (click)="closeRemboursementModal()">
        <div class="modal-content modal-large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Remboursement - Prêt #{{ selectedPret.id }}</h2>
            <button class="btn-close" (click)="closeRemboursementModal()" type="button">&times;</button>
          </div>

          <div *ngIf="loadingEcheances" class="loading-state">
            <div class="spinner"></div>
            <p>Chargement des échéances...</p>
          </div>

          <div *ngIf="!loadingEcheances" class="modal-body-padding">
            <!-- Info du prêt -->
            <div class="info-box info-box-spacing">
              <div>
                <strong>{{ selectedPret.membrePrenom }} {{ selectedPret.membreNom }}</strong> -
                Montant: {{ formatMoney(selectedPret.montant) }} FCFA |
                Reste: <strong>{{ formatMoney(selectedPret.montantRestant) }} FCFA</strong>
              </div>
            </div>

            <!-- Liste des échéances -->
            <div class="echeances-section">
              <h3 class="section-title">Échéancier</h3>

              <div *ngIf="echeances.length === 0" class="alert alert-danger">
                Aucune échéance trouvée pour ce prêt.
              </div>

              <div *ngFor="let ech of echeances"
                   class="echeance-card"
                   [class.selected]="selectedEcheance?.id === ech.id"
                   [class.disabled]="ech.statut === EchStatut.PAYE"
                   (click)="ech.statut !== EchStatut.PAYE && selectEcheance(ech)">
                <div class="echeance-header">
                  <span class="echeance-numero">Échéance #{{ ech.numero }}</span>
                  <span class="badge" [class]="'badge-' + ech.statut">{{ getEcheanceStatutLabel(ech.statut) }}</span>
                </div>
                <div class="echeance-details">
                  <div><strong>Date :</strong> {{ ech.dateEcheance | date:'dd/MM/yyyy' }}</div>
                  <div><strong>Montant:</strong> {{ formatMoney(ech.montantDu) }} FCFA</div>
                </div>
              </div>
            </div>

            <!-- Formulaire de remboursement -->
            <div *ngIf="selectedEcheance" class="remboursement-form">
              <h3 class="section-title">Enregistrer le paiement</h3>

              <div class="form-group">
                <label>Mode de paiement <span class="required">*</span></label>
                <select class="form-control" [(ngModel)]="remboursementData.modePaiement">
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>

              <div class="form-group">
                <label>Montant (FCFA) <span class="required">*</span></label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="remboursementData.montant"
                  min="1"
                  step="1" />
              </div>

              <div class="form-group">
                <label>Référence / Numéro de transaction</label>
                <input
                  type="text"
                  class="form-control"
                  [(ngModel)]="remboursementData.reference"
                  placeholder="Optionnel" />
              </div>

              <div *ngIf="remboursementError" class="alert alert-danger">{{ remboursementError }}</div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeRemboursementModal()">Annuler</button>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="!selectedEcheance || savingRemboursement"
              (click)="submitRemboursement()">
              <span *ngIf="savingRemboursement">Enregistrement...</span>
              <span *ngIf="!savingRemboursement">Enregistrer le paiement</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 30px; }
    .stats-row { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat-card { background: white; border-radius: 8px; padding: 20px; display: flex; align-items: center; gap: 15px; flex: 1; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-icon { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; }
    .stat-icon.bg-info { background: #17a2b8; }
    .stat-icon.bg-warning { background: #ffc107; color: #212529; }
    .stat-icon.bg-primary { background: #667eea; }
    .stat-icon.bg-success { background: #28a745; }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: 24px; font-weight: 700; color: #333; }
    .stat-label { font-size: 14px; color: #6c757d; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .page-header h1 { font-size: 28px; color: #333; margin: 0; }
    .header-actions { display: flex; gap: 12px; }
    .btn-warning { background: #ffc107; color: #212529; position: relative; }
    .btn-warning:hover { background: #e0a800; }
    .badge-count {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #dc3545;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      border: 2px solid white;
    }
    .filters-section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .filter-row { display: flex; gap: 15px; align-items: center; }
    .form-control { padding: 10px; border: 1px solid #ddd; border-radius: 5px; width: 100%; box-sizing: border-box; }
    .filter-row .form-control { width: 250px; }
    .info-message { display: flex; align-items: center; gap: 8px; color: #0056b3; font-size: 14px; font-weight: 500; background: #e7f3ff; padding: 8px 15px; border-radius: 5px; border: 1px solid #b3d9ff; }
    .info-message i { font-size: 16px; }
    .loading-state { text-align: center; padding: 60px; background: white; border-radius: 8px; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .alert { padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .alert-danger { background: #f8d7da; color: #721c24; }
    .table-container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { background: #f8f9fa; padding: 15px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
    .data-table td { padding: 15px; border-bottom: 1px solid #dee2e6; }
    .data-table tbody tr:hover { background: #f8f9fa; }
    .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-DEMANDE { background: #fff3cd; color: #856404; }
    .badge-APPROUVE { background: #d4edda; color: #155724; }
    .badge-REFUSE { background: #f8d7da; color: #721c24; }
    .badge-EN_COURS { background: #cfe2ff; color: #084298; }
    .badge-CLOTURE { background: #e9ecef; color: #495057; }
    .action-buttons { display: flex; gap: 5px; }
    .btn, .btn-icon { padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; transition: all 0.3s; }
    .btn-primary { background: #667eea; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:disabled { opacity: 0.5; }
    .btn-icon { padding: 6px 10px; background: #f8f9fa; border: 1px solid #dee2e6; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
    .btn-icon.btn-primary { background: #495057; color: white; border-color: #495057; }
    .btn-icon.btn-primary:hover { background: #212529; }
    .btn-icon i { font-size: 14px; }
    .btn-success { background: #28a745; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .pagination { display: flex; justify-content: space-between; padding: 20px; background: white; border-radius: 8px; margin-top: 20px; }
    .text-center { text-align: center; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 0; border-radius: 8px; max-width: 600px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-bottom: 1px solid #dee2e6; }
    .modal-header h2 { margin: 0; font-size: 24px; color: #333; }
    .btn-close { background: none; border: none; font-size: 28px; color: #6c757d; cursor: pointer; padding: 0; width: 30px; height: 30px; line-height: 1; }
    .btn-close:hover { color: #333; }
    .form-group { margin-bottom: 20px; }
    .modal-content form .form-group { padding: 0 30px; }
    .modal-content form .form-group:first-of-type { padding-top: 30px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
    .form-group .required { color: #dc3545; }
    .form-control.is-invalid { border-color: #dc3545; }
    .form-row { display: flex; gap: 15px; padding: 0 30px; }
    .form-row .form-group { flex: 1; padding: 0; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 20px 30px; border-top: 1px solid #dee2e6; margin-top: 20px; }
    .modal-content form { padding: 0; }
    .modal-large { max-width: 700px; }
    .info-box { background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 5px; padding: 15px; color: #004085; display: flex; align-items: center; gap: 10px; }
    .info-box i { font-size: 18px; }
    .details-content { padding: 30px; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: 600; color: #555; }
    .detail-value { color: #333; }
    textarea.form-control { width: 100%; resize: vertical; font-family: inherit; }
    .echeances-section { margin-bottom: 20px; }
    .echeance-card { border: 2px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s; }
    .echeance-card:hover { border-color: #667eea; background: #f8f9fa; }
    .echeance-card.selected { border-color: #667eea; background: #e7f3ff; }
    .echeance-card.disabled { opacity: 0.5; cursor: not-allowed; background: #f0f0f0; }
    .echeance-card.disabled:hover { border-color: #dee2e6; background: #f0f0f0; }
    .echeance-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .echeance-numero { font-weight: 600; color: #333; font-size: 16px; }
    .echeance-details { display: flex; gap: 20px; font-size: 14px; color: #555; }
    .badge-EN_ATTENTE { background: #fff3cd; color: #856404; }
    .badge-PAYE { background: #d4edda; color: #155724; }
    .badge-PARTIEL { background: #cfe2ff; color: #084298; }
    .badge-RETARD { background: #f8d7da; color: #721c24; }
    .remboursement-form { border-top: 2px solid #dee2e6; padding-top: 20px; margin-top: 20px; }
    .remboursement-form .form-group { margin-bottom: 20px; padding: 0; }
    .remboursement-form .form-control { width: 100%; }
    .modal-body-padding { padding: 20px 30px; }
    .info-box-spacing { margin-bottom: 20px; }
    .section-title { margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #333; }
    .periode-row { display: flex; gap: 10px; }
    .periode-input { flex: 1; max-width: 100px; }
    .periode-select { flex: 2; }
    .periode-info { display: block; margin-top: 5px; color: #667eea; font-size: 13px; }
    .preuve-image { max-width: 150px; max-height: 100px; border-radius: 5px; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s; }
    .preuve-image:hover { transform: scale(1.05); }
    .preuve-overlay { background: rgba(0,0,0,0.9); }
    .preuve-modal-content { position: relative; max-width: 90%; max-height: 90%; display: flex; align-items: center; justify-content: center; }
    .preuve-fullsize { max-width: 100%; max-height: 90vh; border-radius: 8px; }
    .preuve-close { position: absolute; top: -40px; right: 0; background: white; border-radius: 50%; width: 36px; height: 36px; font-size: 24px; }
    .photo-preview { margin-top: 10px; position: relative; display: inline-block; }
    .photo-preview img { max-width: 150px; max-height: 100px; border-radius: 5px; border: 1px solid #ddd; }
    .btn-remove-photo { position: absolute; top: -8px; right: -8px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  `]
})
export class PretsListComponent implements OnInit {
  private dialog = inject(DialogService);
  private pretService = inject(PretService);
  recus = inject(RecuService);
  preuves = inject(PreuveService);
  private membreService = inject(MembreService);
  private authService = inject(AuthService);
  private remboursementService = inject(RemboursementService);

  isTresorierOrAdmin = false;
  /** Le président (administrateur) confirme les prêts au-dessus du seuil. */
  get isAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  situation: any = null;

  isTresorier = false;
  prets: Pret[] = [];
  loading = false;
  error = '';
  showForm = false;
  filterStatut = '';
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  // Stats pour les cartes résumé
  statsPretsEnAttente = 0;
  statsPretsEnCours = 0;
  statsPretsClotures = 0;
  statsRemboursementsEnAttente = 0;

  // Formulaire
  formData: PretCreate = {
    membreId: 0,
    montant: 0,
    dureeMois: 12
  };
  membres: Membre[] = [];
  loadingMembers = false;
  saving = false;
  formError = '';

  // Exposer les enums pour les utiliser dans le template
  StatutPret = StatutPret;
  EchStatut = EchStatut;

  // Modales
  showDetailsModal = false;
  showRejectModal = false;
  selectedPret: Pret | null = null;
  rejectMotif = '';

  // Modal remboursement
  showRemboursementModal = false;
  echeances: Echeance[] = [];
  loadingEcheances = false;
  selectedEcheance: Echeance | null = null;
  remboursementData: RemboursementCreate = {
    echeanceId: 0,
    montant: 0,
    modePaiement: 'ESPECES',
    reference: ''
  };
  savingRemboursement = false;
  remboursementError = '';

  // Modal décaissement
  showVerserModalState = false;
  verserData = {
    modePaiement: 'ESPECES' as 'ESPECES' | 'MOBILE_MONEY',
    reference: '',
    dateDecaissement: new Date().toISOString().split('T')[0]
  };
  savingVerser = false;

  // Période de remboursement (jour/semaine/mois)
  periodeValeur = 1;
  periodeUnite: 'jour' | 'semaine' | 'mois' = 'mois';
  verserError = '';

  // Preuve de paiement
  showPreuveModal = false;
  currentPreuveImage = '';
  verserPhotoPreview = '';
  verserPhotoBase64 = '';

  ngOnInit(): void {
    // Vérifier si l'utilisateur est trésorier ou admin
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.roles) {
      this.isTresorierOrAdmin = currentUser.roles.some(role =>
        role === 'TRESORIER' || role === 'COMMISSAIRE' || role === 'ADMIN'
      );
      this.isTresorier = currentUser.roles.some(role =>
        role === 'TRESORIER'
      );
    }

    // Les membres ordinaires voient seulement leurs propres prêts
    // Les trésoriers/admins voient tous les prêts
    this.loadPrets();
    if (this.isTresorierOrAdmin) {
      this.loadPretsStats();
    }
  }

  loadPretsStats(): void {
    // Charger les stats pour les différents statuts
    this.pretService.getAll({ statut: StatutPret.DEMANDE, page: 0, size: 1 }).subscribe({
      next: (response) => this.statsPretsEnAttente = response.totalElements,
      error: () => this.statsPretsEnAttente = 0
    });
    this.pretService.getAll({ statut: StatutPret.EN_COURS, page: 0, size: 1 }).subscribe({
      next: (response) => this.statsPretsEnCours = response.totalElements,
      error: () => this.statsPretsEnCours = 0
    });
    this.pretService.getAll({ statut: StatutPret.CLOTURE, page: 0, size: 1 }).subscribe({
      next: (response) => this.statsPretsClotures = response.totalElements,
      error: () => this.statsPretsClotures = 0
    });
    // Charger les remboursements en attente
    this.remboursementService.getPendingRemboursements().subscribe({
      next: (remboursements) => this.statsRemboursementsEnAttente = remboursements.length,
      error: () => this.statsRemboursementsEnAttente = 0
    });
  }

  loadPrets(): void {
    this.loading = true;

    const currentUser = this.authService.getCurrentUser();

    // Si c'est un membre ordinaire, charger uniquement ses prêts
    if (!this.isTresorierOrAdmin && currentUser?.id) {
      this.pretService.getByMembre(currentUser.id).subscribe({
        next: (prets: Pret[]) => {
          // Filtrer par statut si un filtre est appliqué
          this.prets = this.filterStatut
            ? prets.filter(p => p.statut === this.filterStatut)
            : prets;

          // Pagination manuelle pour les membres
          const startIndex = this.currentPage * this.pageSize;
          const endIndex = startIndex + this.pageSize;
          const paginatedPrets = this.prets.slice(startIndex, endIndex);

          this.totalElements = this.prets.length;
          this.totalPages = Math.ceil(this.totalElements / this.pageSize);
          this.prets = paginatedPrets;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Erreur: ' + (err.error?.message || err.message);
          this.loading = false;
        }
      });
    } else {
      // Pour les trésoriers/admins, charger tous les prêts avec pagination
      this.pretService.getAll({
        statut: this.filterStatut ? this.filterStatut as StatutPret : undefined,
        page: this.currentPage,
        size: this.pageSize
      }).subscribe({
        next: (response: PageResponse<Pret>) => {
          this.prets = response.content;
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Erreur: ' + (err.error?.message || err.message);
          this.loading = false;
        }
      });
    }
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadPrets();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadPrets();
  }

  approuver(pret: Pret): void {
    this.selectedPret = pret;
    this.pretService.approuver(pret.id).subscribe({
      next: () => {
        this.loadPrets();
        this.selectedPret = null;
      },
      error: (err) => {
        this.error = 'Erreur lors de l\'approbation: ' + (err.error?.message || err.message);
        this.selectedPret = null;
      }
    });
  }

  async confirmerPret(pret: Pret): Promise<void> {
    const qui = `${pret.membrePrenom || ''} ${pret.membreNom || ''}`.trim();
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: `Confirmer le prêt de ${this.formatMoney(pret.montant)} FCFA demandé par ${qui} ?\nVous autorisez le trésorier à le valider.` })) {
      return;
    }
    this.pretService.confirmer(pret.id).subscribe({
      next: () => this.loadPrets(),
      error: (err) => {
        this.error = 'Erreur lors de la confirmation: ' + (err.error?.message || err.message);
      }
    });
  }

  showRejectModalFn(pret: Pret): void {
    this.selectedPret = pret;
    this.rejectMotif = '';
    this.showRejectModal = true;
  }

  rejeter(): void {
    if (!this.selectedPret) return;

    this.pretService.rejeter(this.selectedPret.id, this.rejectMotif).subscribe({
      next: () => {
        this.loadPrets();
        this.closeRejectModal();
      },
      error: (err) => {
        this.error = 'Erreur lors du rejet: ' + (err.error?.message || err.message);
        this.closeRejectModal();
      }
    });
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.selectedPret = null;
    this.rejectMotif = '';
  }

  addRemboursement(pret: Pret): void {
    this.selectedPret = pret;
    this.showRemboursementModal = true;
    this.remboursementError = '';
    this.loadEcheances(pret.id);
  }

  loadEcheances(pretId: number): void {
    this.loadingEcheances = true;
    this.remboursementService.getEcheancesByPret(pretId).subscribe({
      next: (echeances) => {
        this.echeances = echeances;
        this.loadingEcheances = false;
      },
      error: (err) => {
        this.remboursementError = 'Erreur lors du chargement des échéances: ' + (err.error?.message || err.message);
        this.loadingEcheances = false;
      }
    });
  }

  selectEcheance(echeance: Echeance): void {
    this.selectedEcheance = echeance;
    this.remboursementData = {
      echeanceId: echeance.id,
      montant: echeance.montantDu,
      modePaiement: 'ESPECES',
      reference: ''
    };
  }

  submitRemboursement(): void {
    if (!this.selectedEcheance) {
      this.remboursementError = 'Veuillez sélectionner une échéance.';
      return;
    }

    if (!this.remboursementData.montant || this.remboursementData.montant <= 0) {
      this.remboursementError = 'Le montant doit être supérieur à 0.';
      return;
    }

    this.savingRemboursement = true;
    this.remboursementError = '';

    this.remboursementService.enregistrerRemboursement(this.remboursementData).subscribe({
      next: (ack) => {
        this.savingRemboursement = false;
        this.closeRemboursementModal();
        this.loadPrets();
      },
      error: (err) => {
        this.savingRemboursement = false;
        this.remboursementError = 'Erreur: ' + (err.error?.message || err.message);
      }
    });
  }

  closeRemboursementModal(): void {
    this.showRemboursementModal = false;
    this.selectedPret = null;
    this.selectedEcheance = null;
    this.echeances = [];
    this.remboursementData = {
      echeanceId: 0,
      montant: 0,
      modePaiement: 'ESPECES',
      reference: ''
    };
    this.remboursementError = '';
  }

  getEcheanceStatutLabel(statut: EchStatut): string {
    const labels: Record<EchStatut, string> = {
      [EchStatut.EN_ATTENTE]: 'En attente',
      [EchStatut.PAYE]: 'Payé',
      [EchStatut.PARTIEL]: 'Partiel',
      [EchStatut.RETARD]: 'En retard'
    };
    return labels[statut] || statut;
  }

  showVerserModal(pret: Pret): void {
    this.selectedPret = pret;
    this.showVerserModalState = true;
    this.verserError = '';
    this.verserData = {
      modePaiement: 'ESPECES',
      reference: '',
      dateDecaissement: new Date().toISOString().split('T')[0]
    };
  }

  submitVerser(): void {
    if (!this.selectedPret) return;

    if (!this.verserData.dateDecaissement) {
      this.verserError = 'La date de décaissement est requise.';
      return;
    }

    this.savingVerser = true;
    this.verserError = '';

    const verserPayload = {
      ...this.verserData,
      photoPreuve: this.verserPhotoBase64 || undefined
    };

    this.pretService.verser(this.selectedPret.id, verserPayload).subscribe({
      next: () => {
        this.savingVerser = false;
        this.closeVerserModal();
        this.loadPrets();
      },
      error: (err) => {
        this.savingVerser = false;
        this.verserError = 'Erreur: ' + (err.error?.message || err.message);
      }
    });
  }

  closeVerserModal(): void {
    this.showVerserModalState = false;
    this.selectedPret = null;
    this.verserData = {
      modePaiement: 'ESPECES',
      reference: '',
      dateDecaissement: new Date().toISOString().split('T')[0]
    };
    this.verserError = '';
    this.verserPhotoPreview = '';
    this.verserPhotoBase64 = '';
  }

  // Gestion des preuves de paiement
  openPreuveModal(imageUrl: string): void {
    this.currentPreuveImage = imageUrl;
    this.showPreuveModal = true;
  }

  closePreuveModal(): void {
    this.showPreuveModal = false;
    this.currentPreuveImage = '';
  }

  onVerserPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // Réduire la photo (taille et poids) avant envoi
      compresserImage(file).then(
        (image) => {
          this.verserPhotoPreview = image;
          this.verserPhotoBase64 = image;
        },
        (err) => {
          this.dialog.erreur(err?.message || 'Image illisible. Choisissez une photo JPG, PNG ou WebP.');
          input.value = '';
        }
      );
    }
  }

  removeVerserPhoto(): void {
    this.verserPhotoPreview = '';
    this.verserPhotoBase64 = '';
  }

  viewDetails(pret: Pret): void {
    this.selectedPret = pret;
    this.showDetailsModal = true;
    // L'image de la preuve n'est pas dans la liste : elle se charge à l'ouverture
    if (!pret.photoPreuve && pret.aPreuve) {
      this.preuves.charger('prets', pret.id).subscribe({
        next: (data) => { pret.photoPreuve = data; },
        error: () => { this.dialog.erreur('Impossible de charger la preuve de paiement.'); }
      });
    }
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedPret = null;
  }

  getStatut(statut: StatutPret): string {
    const labels: Record<StatutPret, string> = {
      [StatutPret.DEMANDE]: 'En attente',
      [StatutPret.APPROUVE]: 'Approuvé',
      [StatutPret.REFUSE]: 'Rejeté',
      [StatutPret.EN_COURS]: 'En cours',
      [StatutPret.CLOTURE]: 'Clôturé'
    };
    return labels[statut] || statut;
  }

  getPeriodeUniteLabel(unite?: string): string {
    if (!unite) return 'mois';
    switch (unite.toUpperCase()) {
      case 'JOUR': return 'jour(s)';
      case 'SEMAINE': return 'semaine(s)';
      case 'MOIS':
      default: return 'mois';
    }
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount);
  }

  showFormModal(): void {
    this.showForm = true;
    this.formError = '';

    // Utiliser l'ID de l'utilisateur connecté (pour tous les utilisateurs)
    const currentUser = this.authService.getCurrentUser();
    const membreId = currentUser?.id || 0;

    // Réinitialiser la période
    this.periodeValeur = 1;
    this.periodeUnite = 'mois';

    this.formData = {
      membreId: membreId,
      montant: 0,
      dureeMois: 1
    };

    // Situation du membre : à jour de ses cotisations, prêts déjà en cours, plafond
    this.situation = null;
    if (membreId) {
      this.membreService.getSituation(membreId).subscribe({
        next: (s) => { this.situation = s; },
        error: () => { this.situation = null; }
      });
    }
  }

  closeModal(): void {
    this.showForm = false;
    this.formError = '';
    this.periodeValeur = 1;
    this.periodeUnite = 'mois';
    this.formData = {
      membreId: 0,
      montant: 0,
      dureeMois: 1
    };
  }

  loadMembers(): void {
    this.loadingMembers = true;
    this.membreService.getAll({ page: 0, size: 1000 }).subscribe({
      next: (response: PageResponse<Membre>) => {
        // Filtrer seulement les membres actifs
        this.membres = response.content.filter(m => m.etatCompte === 'ACTIF');
        this.loadingMembers = false;
        if (this.membres.length === 0) {
          this.formError = 'Aucun membre actif trouvé. Veuillez activer des membres avant de créer un prêt.';
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des membres:', err);
        this.loadingMembers = false;
        this.formError = 'Erreur lors du chargement des membres: ' + (err.error?.message || err.message);
      }
    });
  }

  onFormChange(): void {
    // Cette méthode force Angular à vérifier la validité du formulaire
  }

  onPeriodeChange(): void {
    // Convertir la période en nombre d'échéances (dureeMois stocke le nombre d'échéances)
    this.formData.dureeMois = this.getEcheancesCount();
  }

  getEcheancesCount(): number {
    const val = Number(this.periodeValeur) || 0;
    switch (this.periodeUnite) {
      case 'jour':
        return val; // 1 échéance par jour
      case 'semaine':
        return val; // 1 échéance par semaine
      case 'mois':
        return val; // 1 échéance par mois
      default:
        return val;
    }
  }

  getPeriodeLabel(): string {
    const val = this.periodeValeur;
    switch (this.periodeUnite) {
      case 'jour':
        return val === 1 ? '1 jour' : `${val} jours`;
      case 'semaine':
        return val === 1 ? '1 semaine' : `${val} semaines`;
      case 'mois':
        return val === 1 ? '1 mois' : `${val} mois`;
      default:
        return `${val}`;
    }
  }

  isFormValid(): boolean {
    const montant = Number(this.formData.montant);
    const echeances = this.getEcheancesCount();
    const membreId = Number(this.formData.membreId);
    return membreId > 0 && montant > 0 && echeances > 0;
  }

  onSubmit(event: Event): void {
    event.preventDefault();

    // Utiliser l'ID de l'utilisateur connecté
    const membreId = Number(this.formData.membreId);
    const montant = Number(this.formData.montant);
    const dureeMois = Number(this.formData.dureeMois);

    // Validation
    if (!membreId || membreId <= 0) {
      this.formError = 'Impossible de déterminer votre ID membre. Veuillez vous reconnecter.';
      return;
    }

    if (!montant || montant <= 0) {
      this.formError = 'Le montant doit être supérieur à 0.';
      return;
    }

    if (!dureeMois || dureeMois < 1) {
      this.formError = 'Veuillez sélectionner une période de remboursement.';
      return;
    }

    this.saving = true;
    this.formError = '';

    // Convertir l'unité de période pour le backend
    const periodeUniteBackend = this.periodeUnite === 'jour' ? 'JOUR'
      : this.periodeUnite === 'semaine' ? 'SEMAINE' : 'MOIS';

    // Préparer les données pour l'envoi
    const pretData: PretCreate = {
      membreId: membreId,
      montant: montant,
      dureeMois: dureeMois,
      periodeUnite: periodeUniteBackend,
      motif: this.formData.motif || undefined
    };

    this.pretService.create(pretData).subscribe({
      next: (pret) => {
        console.log('Prêt créé avec succès:', pret);
        this.saving = false;
        this.closeModal();
        this.loadPrets();
      },
      error: (err) => {
        console.error('Erreur lors de la création du prêt:', err);
        this.saving = false;
        const errorMessage = err.error?.message || err.error?.error || err.message || 'Une erreur est survenue';
        this.formError = 'Erreur lors de la création du prêt: ' + errorMessage;
      }
    });
  }
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount);
}
