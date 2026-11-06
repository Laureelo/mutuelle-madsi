import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RemboursementService } from '../../services/remboursement.service';
import { RemboursementPret } from '../../models/echeance.model';
import { Pret } from '../../models/pret.model';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-remboursements-pending',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="pending-container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1><i class="bi bi-clock-history"></i> Remboursements en Attente</h1>
          <button class="btn btn-outline" (click)="loadPendingRemboursements()">
            <i class="bi bi-arrow-clockwise" [class.spinning]="loading"></i>
            Actualiser
          </button>
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
      </div>

      <!-- Content -->
      <div *ngIf="!loading && !error" class="content">
        <!-- Empty State -->
        <div *ngIf="pendingRemboursements.length === 0" class="empty-state">
          <i class="bi bi-check-circle"></i>
          <h2>Aucun remboursement en attente</h2>
          <p>Tous les remboursements ont été traités</p>
        </div>

        <!-- List -->
        <div *ngIf="pendingRemboursements.length > 0" class="remboursements-list">
          <div 
            *ngFor="let remb of pendingRemboursements" 
            class="remboursement-card">
            <div class="card-header">
              <div>
                <h3>Remboursement #{{ remb.id }}</h3>
                <span class="badge badge-warning">En attente</span>
              </div>
              <span class="amount">{{ formatMoney(remb.montant) }} FCFA</span>
            </div>

            <div class="card-body">
              <div class="info-grid">
                <div class="info-item">
                  <label>Date de paiement</label>
                  <span>{{ formatDate(remb.datePaiement) }}</span>
                </div>
                <div class="info-item">
                  <label>Mode de paiement</label>
                  <span class="badge badge-info">{{ remb.modePaiement === 'MOBILE_MONEY' ? 'Mobile Money' : 'Espèces' }}</span>
                </div>
                <div class="info-item" *ngIf="remb.reference">
                  <label>Référence</label>
                  <span class="reference">{{ remb.reference }}</span>
                </div>
                <div class="info-item" *ngIf="pretMap[remb.echeanceId]">
                  <label>Prêt</label>
                  <span>Prêt #{{ pretMap[remb.echeanceId].id }} - {{ formatMoney(pretMap[remb.echeanceId].montant) }} FCFA</span>
                </div>
              </div>

              <div *ngIf="remb.preuveUrl" class="preuve-section">
                <label>Preuve de paiement</label>
                <img
                  *ngIf="isBase64Image(remb.preuveUrl)"
                  [src]="remb.preuveUrl"
                  alt="Preuve de paiement"
                  class="preuve-image"
                  (click)="openPreuveModal(remb.preuveUrl)" />
                <a *ngIf="!isBase64Image(remb.preuveUrl)" [href]="remb.preuveUrl" target="_blank" class="preuve-link">
                  <i class="bi bi-file-earmark-image"></i>
                  Voir la preuve
                </a>
              </div>
            </div>

            <div class="card-actions">
              <button 
                class="btn btn-success"
                (click)="validerRemboursement(remb)"
                [disabled]="processing[remb.id]">
                <i class="bi bi-check-circle"></i>
                Valider
              </button>
              <button 
                class="btn btn-danger"
                (click)="showRejectModal(remb)"
                [disabled]="processing[remb.id]">
                <i class="bi bi-x-circle"></i>
                Rejeter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de rejet -->
    <div *ngIf="showRejectModalState && selectedRemboursement" class="modal-overlay" (click)="closeRejectModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Rejeter le remboursement</h2>
          <button class="btn-close" (click)="closeRejectModal()">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div class="modal-body">
          <p>Êtes-vous sûr de vouloir rejeter ce remboursement de <strong>{{ formatMoney(selectedRemboursement.montant) }} FCFA</strong> ?</p>
          <div class="form-group">
            <label>Motif du rejet (optionnel)</label>
            <textarea 
              class="form-control" 
              [(ngModel)]="rejectMotif"
              rows="3"
              placeholder="Entrez le motif du rejet..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeRejectModal()">Annuler</button>
          <button
            class="btn btn-danger"
            (click)="rejeterRemboursement()"
            [disabled]="processing[selectedRemboursement.id]">
            Rejeter
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de visualisation de la preuve -->
    <div *ngIf="showPreuveModalState" class="modal-overlay preuve-overlay" (click)="closePreuveModal()">
      <div class="preuve-modal-content" (click)="$event.stopPropagation()">
        <button class="btn-close preuve-close" (click)="closePreuveModal()">
          <i class="bi bi-x"></i>
        </button>
        <img [src]="currentPreuveImage" alt="Preuve de paiement" class="preuve-fullsize" />
      </div>
    </div>
  `,
  styles: [`
    .pending-container {
      min-height: 100vh;
      background: #f8f9fa;
    }

    .header {
      background: white;
      border-bottom: 1px solid #dee2e6;
      padding: 20px 0;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0;
      color: #212529;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    /* Cards */
    .remboursement-card {
      background: white;
      border-radius: 8px;
      border: 1px solid #dee2e6;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .card-header {
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8f9fa;
    }

    .card-header h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      color: #212529;
    }

    .card-header .amount {
      font-size: 20px;
      font-weight: 700;
      color: #495057;
    }

    .card-body {
      padding: 20px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .info-item label {
      font-size: 12px;
      font-weight: 600;
      color: #6c757d;
      text-transform: uppercase;
    }

    .info-item span {
      font-size: 14px;
      color: #212529;
    }

    .info-item .reference {
      font-family: monospace;
      background: #f8f9fa;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .preuve-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #dee2e6;
    }

    .preuve-section label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #6c757d;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .preuve-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #495057;
      text-decoration: none;
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .preuve-link:hover {
      background: #f8f9fa;
      border-color: #495057;
    }

    .preuve-image {
      max-width: 200px;
      max-height: 150px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid #dee2e6;
      transition: transform 0.2s;
    }

    .preuve-image:hover {
      transform: scale(1.05);
    }

    .preuve-overlay {
      background: rgba(0, 0, 0, 0.9);
    }

    .preuve-modal-content {
      position: relative;
      max-width: 90%;
      max-height: 90%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preuve-fullsize {
      max-width: 100%;
      max-height: 90vh;
      border-radius: 8px;
    }

    .preuve-close {
      position: absolute;
      top: -40px;
      right: 0;
      background: white;
      border-radius: 50%;
      width: 36px;
      height: 36px;
    }

    .card-actions {
      padding: 16px 20px;
      border-top: 1px solid #dee2e6;
      background: #f8f9fa;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
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

    .btn-outline {
      background: white;
      color: #495057;
      border: 1px solid #dee2e6;
    }

    .btn-outline:hover {
      background: #f8f9fa;
    }

    .btn-success {
      background: #28a745;
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #218838;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c82333;
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
      display: inline-block;
    }

    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }

    .badge-info {
      background: #d1ecf1;
      color: #0c5460;
    }

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

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Error */
    .alert-error {
      margin: 24px;
      padding: 16px;
      border-radius: 8px;
      background: #fff5f5;
      color: #c53030;
      border-left: 4px solid #f56565;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: white;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .empty-state i {
      font-size: 64px;
      color: #28a745;
      margin-bottom: 16px;
    }

    .empty-state h2 {
      font-size: 24px;
      font-weight: 600;
      color: #212529;
      margin: 0 0 8px 0;
    }

    .empty-state p {
      font-size: 16px;
      color: #6c757d;
      margin: 0;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      color: #212529;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #6c757d;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-close:hover {
      color: #212529;
    }

    .modal-body {
      padding: 24px;
    }

    .modal-body p {
      margin: 0 0 16px 0;
      color: #495057;
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

    .form-control {
      padding: 10px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #dee2e6;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .info-grid {
        grid-template-columns: 1fr;
      }

      .card-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class RemboursementsPendingComponent implements OnInit {
  private dialog = inject(DialogService);
  private remboursementService = inject(RemboursementService);

  pendingRemboursements: RemboursementPret[] = [];
  pretMap: Record<number, Pret> = {};
  loading = false;
  error = '';
  processing: Record<number, boolean> = {};

  showRejectModalState = false;
  selectedRemboursement: RemboursementPret | null = null;
  rejectMotif = '';

  // Preuve modal
  showPreuveModalState = false;
  currentPreuveImage = '';

  ngOnInit(): void {
    this.loadPendingRemboursements();
  }

  loadPendingRemboursements(): void {
    this.loading = true;
    this.error = '';

    this.remboursementService.getPendingRemboursements().subscribe({
      next: (remboursements) => {
        this.pendingRemboursements = remboursements;
        this.loading = false;
        // Charger les prêts associés pour afficher les détails
        this.loadPretsForRemboursements(remboursements);
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  loadPretsForRemboursements(remboursements: RemboursementPret[]): void {
    // Récupérer les IDs d'échéances uniques
    const echeanceIds = [...new Set(remboursements.map(r => r.echeanceId))];
    
    // Pour chaque échéance, charger le prêt associé
    echeanceIds.forEach(echeanceId => {
      // Note: Vous devrez peut-être créer un endpoint pour récupérer le prêt par échéance
      // Pour l'instant, on laisse vide
    });
  }

  async validerRemboursement(remb: RemboursementPret): Promise<void> {
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: `Valider le remboursement de ${this.formatMoney(remb.montant)} FCFA ?` })) {
      return;
    }

    this.processing[remb.id] = true;

    this.remboursementService.validerMobileMoney(remb.id).subscribe({
      next: () => {
        this.processing[remb.id] = false;
        this.loadPendingRemboursements();
        this.dialog.succes('Remboursement validé avec succès!');
      },
      error: (err) => {
        this.processing[remb.id] = false;
        this.error = 'Erreur lors de la validation: ' + (err.error?.message || err.message);
      }
    });
  }

  showRejectModal(remb: RemboursementPret): void {
    this.selectedRemboursement = remb;
    this.rejectMotif = '';
    this.showRejectModalState = true;
  }

  closeRejectModal(): void {
    this.showRejectModalState = false;
    this.selectedRemboursement = null;
    this.rejectMotif = '';
  }

  rejeterRemboursement(): void {
    if (!this.selectedRemboursement) return;

    this.processing[this.selectedRemboursement.id] = true;

    this.remboursementService.rejeterMobileMoney(
      this.selectedRemboursement.id,
      this.rejectMotif || 'Remboursement rejeté'
    ).subscribe({
      next: () => {
        this.processing[this.selectedRemboursement!.id] = false;
        this.closeRejectModal();
        this.loadPendingRemboursements();
        this.dialog.succes('Remboursement rejeté');
      },
      error: (err) => {
        this.processing[this.selectedRemboursement!.id] = false;
        this.error = 'Erreur lors du rejet: ' + (err.error?.message || err.message);
      }
    });
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

  isBase64Image(url: string): boolean {
    return url?.startsWith('data:image');
  }

  openPreuveModal(imageUrl: string): void {
    this.currentPreuveImage = imageUrl;
    this.showPreuveModalState = true;
  }

  closePreuveModal(): void {
    this.showPreuveModalState = false;
    this.currentPreuveImage = '';
  }
}
