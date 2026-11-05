import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PretService } from '../../services/pret.service';
import { RemboursementService } from '../../services/remboursement.service';
import { AuthService } from '../../services/auth.service';
import { Pret, StatutPret } from '../../models/pret.model';
import { Echeance, EchStatut, RemboursementCreate } from '../../models/echeance.model';
import { RecuService } from '../../services/recu.service';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-remboursement-simple',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="remboursement-container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <a [routerLink]="['/prets']" class="back-link">
            <i class="bi bi-arrow-left"></i>
            Retour
          </a>
          <h1>Remboursement de Prêt</h1>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading-container">
        <div class="spinner"></div>
        <p>Chargement...</p>
      </div>

      <!-- Error -->
      <div *ngIf="error" class="alert-error">
        <i class="bi bi-exclamation-triangle"></i>
        <div>
          <strong>Erreur</strong>
          <p>{{ error }}</p>
        </div>
        <button class="btn-close" (click)="error = ''">
          <i class="bi bi-x"></i>
        </button>
      </div>

      <!-- Content -->
      <div *ngIf="pret && !loading" class="content">
        <!-- Info du prêt -->
        <div class="pret-info-card">
          <div class="pret-header">
            <h2>Prêt #{{ pret.id }}</h2>
            <span class="badge" [class]="'badge-' + pret.statut">{{ getStatutLabel(pret.statut) }}</span>
          </div>
          <div class="pret-details">
            <div class="detail-item">
              <label>Montant total</label>
              <span class="value">{{ formatMoney(pret.montant) }} FCFA</span>
            </div>
            <div class="detail-item">
              <label>Durée</label>
              <span class="value">{{ pret.duree }} mois</span>
            </div>
            <div class="detail-item">
              <label>Remboursé</label>
              <span class="value success">{{ formatMoney(pret.montantRembourse) }} FCFA</span>
            </div>
            <div class="detail-item">
              <label>Reste à payer</label>
              <span class="value highlight">{{ formatMoney(pret.montantRestant) }} FCFA</span>
            </div>
          </div>
        </div>

        <!-- Échéances -->
        <div class="echeances-card">
          <h3><i class="bi bi-calendar-check"></i> Échéances</h3>
          
          <div *ngIf="loadingEcheances" class="loading-inline">
            <div class="spinner-small"></div>
            <span>Chargement des échéances...</span>
          </div>

          <div *ngIf="!loadingEcheances && echeances.length === 0" class="empty-state">
            <i class="bi bi-inbox"></i>
            <p>Aucune échéance disponible</p>
          </div>

          <div *ngIf="!loadingEcheances && echeances.length > 0" class="echeances-list">
            <div 
              *ngFor="let ech of echeances" 
              class="echeance-item"
              [class.selected]="selectedEcheance?.id === ech.id"
              [class.paid]="ech.statut === EchStatut.PAYE"
              (click)="ech.statut !== EchStatut.PAYE && selectEcheance(ech)">
              <div class="echeance-header">
                <div>
                  <strong>Échéance #{{ ech.numero }}</strong>
                  <span class="date">{{ formatDate(ech.dateEcheance) }}</span>
                </div>
                <span class="badge" [class]="'badge-' + ech.statut">
                  {{ getEcheanceStatutLabel(ech.statut) }}
                </span>
              </div>
              <div class="echeance-amount">
                Montant: <strong>{{ formatMoney(ech.montantDu) }} FCFA</strong>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="dernierRecuOperationId" class="info-card">
          <i class="bi bi-check-circle"></i>
          <p>Remboursement enregistré avec succès.</p>
          <button type="button" class="btn btn-primary" (click)="recus.ouvrirOperation(dernierRecuOperationId)">
            <i class="bi bi-file-earmark-pdf"></i> Voir le reçu
          </button>
        </div>

        <!-- Formulaire de remboursement -->
        <div *ngIf="selectedEcheance" class="remboursement-form-card">
          <h3><i class="bi bi-cash-coin"></i> {{ isTresorier ? 'Enregistrer le paiement' : 'Déclarer mon paiement' }}</h3>
          <p *ngIf="!isTresorier" class="form-help">
            Payez par mobile money puis indiquez ici le numéro de transaction : le trésorier vérifiera et validera votre paiement.
          </p>
          
          <form (ngSubmit)="submitRemboursement()" class="form">
            <div class="form-group">
              <label>Mode de paiement <span class="required">*</span></label>
              <select 
                class="form-control" 
                [(ngModel)]="remboursementData.modePaiement"
                name="modePaiement"
                required>
                <option *ngIf="isTresorier" value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>

            <div class="form-group">
              <label>Montant (FCFA) <span class="required">*</span></label>
              <input
                type="number"
                class="form-control"
                [(ngModel)]="remboursementData.montant"
                name="montant"
                [min]="1"
                [max]="resteDu"
                step="1"
                required />
              <small class="form-help">
                Reste dû sur cette échéance : {{ formatMoney(resteDu) }} FCFA
              </small>
            </div>

            <div class="form-group" *ngIf="remboursementData.modePaiement === 'MOBILE_MONEY'">
              <label>Numéro de transaction <span class="required">*</span></label>
              <input
                type="text"
                class="form-control"
                [(ngModel)]="remboursementData.reference"
                name="reference"
                placeholder="Ex: 1234567890"
                required />
              <small class="form-help">
                Entrez le numéro de transaction reçu par SMS
              </small>
            </div>

            <div class="form-group" *ngIf="remboursementData.modePaiement === 'ESPECES'">
              <label>Référence (optionnel)</label>
              <input
                type="text"
                class="form-control"
                [(ngModel)]="remboursementData.reference"
                name="reference"
                placeholder="Ex: Reçu #123" />
            </div>

            <div *ngIf="remboursementError" class="alert-error">
              {{ remboursementError }}
            </div>

            <div class="form-actions">
              <button 
                type="button" 
                class="btn btn-secondary" 
                (click)="selectedEcheance = null">
                Annuler
              </button>
              <button 
                type="submit" 
                class="btn btn-primary"
                [disabled]="saving || !isFormValid()">
                <span *ngIf="saving">
                  <i class="bi bi-arrow-clockwise spinning"></i>
                  Enregistrement...
                </span>
                <span *ngIf="!saving">
                  <i class="bi bi-check-circle"></i>
                  Enregistrer le paiement
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- Message si aucune échéance sélectionnée -->
        <div *ngIf="!selectedEcheance && echeances.length > 0" class="info-card">
          <i class="bi bi-info-circle"></i>
          <p>Sélectionnez une échéance ci-dessus pour enregistrer un remboursement</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .remboursement-container {
      min-height: 100vh;
      background: #f8f9fa;
    }

    .header {
      background: white;
      border-bottom: 1px solid #dee2e6;
      padding: 20px 0;
    }

    .header-content {
      max-width: 900px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .back-link {
      color: #495057;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      transition: color 0.2s;
    }

    .back-link:hover {
      color: #212529;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0;
      color: #212529;
    }

    .content {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Cards */
    .pret-info-card,
    .echeances-card,
    .remboursement-form-card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      border: 1px solid #dee2e6;
    }

    .pret-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .pret-header h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      color: #212529;
    }

    .pret-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-item label {
      font-size: 12px;
      font-weight: 600;
      color: #6c757d;
      text-transform: uppercase;
    }

    .detail-item .value {
      font-size: 16px;
      color: #212529;
    }

    .detail-item .value.success {
      color: #28a745;
      font-weight: 600;
    }

    .detail-item .value.highlight {
      color: #dc3545;
      font-weight: 700;
      font-size: 18px;
    }

    /* Echeances */
    .echeances-card h3,
    .remboursement-form-card h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 20px 0;
      color: #212529;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .echeances-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .echeance-item {
      padding: 16px;
      border: 2px solid #dee2e6;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .echeance-item:hover:not(.paid) {
      border-color: #495057;
      background: #f8f9fa;
    }

    .echeance-item.selected {
      border-color: #495057;
      background: #e7f3ff;
    }

    .echeance-item.paid {
      opacity: 0.6;
      cursor: not-allowed;
      background: #f0f0f0;
    }

    .echeance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .echeance-header strong {
      font-size: 16px;
      color: #212529;
    }

    .echeance-header .date {
      font-size: 14px;
      color: #6c757d;
      margin-left: 8px;
    }

    .echeance-amount {
      font-size: 14px;
      color: #495057;
    }

    /* Form */
    .form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: #212529;
    }

    .required {
      color: #dc3545;
    }

    .form-control {
      padding: 10px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: #495057;
    }

    .form-help {
      font-size: 12px;
      color: #6c757d;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    /* Buttons */
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: #495057;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #212529;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background: #5a6268;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Badges */
    .badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .badge-DEMANDE { background: #fff3cd; color: #856404; }
    .badge-APPROUVE { background: #d4edda; color: #155724; }
    .badge-REFUSE { background: #f8d7da; color: #721c24; }
    .badge-EN_COURS { background: #cfe2ff; color: #084298; }
    .badge-CLOTURE { background: #e9ecef; color: #495057; }
    .badge-EN_ATTENTE { background: #fff3cd; color: #856404; }
    .badge-PAYE { background: #d4edda; color: #155724; }
    .badge-PARTIEL { background: #cfe2ff; color: #084298; }
    .badge-RETARD { background: #f8d7da; color: #721c24; }

    /* Loading */
    .loading-container {
      text-align: center;
      padding: 60px 20px;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #495057;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    .loading-inline {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 20px;
      color: #6c757d;
    }

    .spinner-small {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #495057;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Error */
    .alert-error {
      padding: 12px 16px;
      border-radius: 6px;
      background: #fff5f5;
      color: #c53030;
      border-left: 4px solid #f56565;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .alert-error i {
      font-size: 18px;
      margin-top: 2px;
    }

    .btn-close {
      background: none;
      border: none;
      color: #c53030;
      cursor: pointer;
      padding: 0;
      margin-left: auto;
      font-size: 18px;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #6c757d;
    }

    .empty-state i {
      font-size: 40px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .info-card {
      background: #e7f3ff;
      border: 1px solid #b3d9ff;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #004085;
    }

    .info-card i {
      font-size: 20px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .pret-details {
        grid-template-columns: 1fr;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class RemboursementSimpleComponent implements OnInit {
  private dialog = inject(DialogService);
  private pretService = inject(PretService);
  recus = inject(RecuService);
  private remboursementService = inject(RemboursementService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  resteDu = 0;
  dernierRecuOperationId: number | null = null;

  get isTresorier(): boolean {
    return this.authService.hasRole('TRESORIER');
  }

  pret: Pret | null = null;
  echeances: Echeance[] = [];
  selectedEcheance: Echeance | null = null;
  loading = false;
  loadingEcheances = false;
  error = '';
  saving = false;
  remboursementError = '';

  remboursementData: RemboursementCreate = {
    echeanceId: 0,
    montant: 0,
    modePaiement: 'ESPECES',
    reference: ''
  };

  EchStatut = EchStatut;

  ngOnInit(): void {
    const pretId = this.route.snapshot.paramMap.get('pretId');
    if (pretId) {
      this.loadPret(+pretId);
    } else {
      this.error = 'ID de prêt manquant';
    }
  }

  loadPret(pretId: number): void {
    this.loading = true;
    this.error = '';

    this.pretService.getById(pretId).subscribe({
      next: (pret) => {
        this.pret = pret;
        this.loading = false;
        this.loadEcheances(pretId);
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement du prêt: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  loadEcheances(pretId: number): void {
    this.loadingEcheances = true;
    this.remboursementService.getEcheancesByPret(pretId).subscribe({
      next: (echeances) => {
        this.echeances = echeances;
        this.loadingEcheances = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des échéances: ' + (err.error?.message || err.message);
        this.loadingEcheances = false;
      }
    });
  }

  selectEcheance(echeance: Echeance): void {
    this.selectedEcheance = echeance;
    this.resteDu = echeance.montantDu;
    this.remboursementData = {
      echeanceId: echeance.id,
      montant: echeance.montantDu,
      modePaiement: this.isTresorier ? 'ESPECES' : 'MOBILE_MONEY',
      reference: ''
    };
    this.remboursementError = '';
    // Le reste dû tient compte de ce qui a déjà été payé sur cette échéance
    this.remboursementService.getSolde(echeance.id).subscribe({
      next: (s) => {
        this.resteDu = s.reste;
        if (this.remboursementData.echeanceId === echeance.id) {
          this.remboursementData.montant = s.reste;
        }
      },
      error: () => { /* on garde le montant de l'échéance */ }
    });
  }

  isFormValid(): boolean {
    if (!this.selectedEcheance) return false;
    if (!this.remboursementData.montant || this.remboursementData.montant <= 0) return false;
    if (this.remboursementData.modePaiement === 'MOBILE_MONEY' && !this.remboursementData.reference) return false;
    return true;
  }

  submitRemboursement(): void {
    if (!this.isFormValid()) {
      this.remboursementError = 'Veuillez remplir tous les champs requis';
      return;
    }

    this.saving = true;
    this.remboursementError = '';
    this.dernierRecuOperationId = null;
    const d = this.remboursementData;
    const echec = (err: any) => {
      this.saving = false;
      this.remboursementError = 'Erreur: ' + (err.error?.message || err.message);
    };

    if (this.isTresorier) {
      // Le trésorier enregistre le paiement (espèces) ou valide un paiement mobile : reçu immédiat
      this.remboursementService.enregistrerRemboursement(d).subscribe({
        next: (ack) => {
          this.saving = false;
          if (this.pret) {
            this.loadPret(this.pret.id);
          }
          this.selectedEcheance = null;
          this.dernierRecuOperationId = ack.operationId;
        },
        error: echec
      });
    } else {
      // Le membre déclare son paiement mobile : le trésorier le validera
      this.remboursementService.soumettreMobileMoney(d.echeanceId, d.montant, d.reference || '').subscribe({
        next: () => {
          this.saving = false;
          if (this.pret) {
            this.loadPret(this.pret.id);
          }
          this.selectedEcheance = null;
          this.dialog.info('Votre paiement a été déclaré.\nIl sera validé par le trésorier, qui vous remettra un reçu.');
        },
        error: echec
      });
    }
  }

  getStatutLabel(statut: StatutPret): string {
    const labels: Record<StatutPret, string> = {
      [StatutPret.DEMANDE]: 'En attente',
      [StatutPret.APPROUVE]: 'Approuvé',
      [StatutPret.REFUSE]: 'Rejeté',
      [StatutPret.EN_COURS]: 'En cours',
      [StatutPret.CLOTURE]: 'Clôturé'
    };
    return labels[statut] || statut;
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

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
