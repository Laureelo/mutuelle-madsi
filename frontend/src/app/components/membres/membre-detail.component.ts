import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MembreService } from '../../services/membre.service';
import { CotisationService } from '../../services/cotisation.service';
import { PretService } from '../../services/pret.service';
import { AdhesionService } from '../../services/adhesion.service';
import { AuthService } from '../../services/auth.service';
import { StatsService } from '../../services/stats.service';
import { Membre, EtatCompte, RoleMembre } from '../../models/membre.model';
import { Cotisation } from '../../models/cotisation.model';
import { Pret } from '../../models/pret.model';
import { Adhesion } from '../../models/adhesion.model';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-membre-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="membre-profile-container">
      <!-- Header -->
      <div class="profile-header">
        <div class="header-content">
          <div class="header-left">
            <a [routerLink]="['/membres']" class="back-link">
              <i class="bi bi-arrow-left"></i>
              Retour
            </a>
            <div class="header-title">
              <h1>Profil du Membre</h1>
              <p *ngIf="membre">{{ membre.firstName }} {{ membre.lastName }}</p>
            </div>
          </div>
          <div class="header-actions">
            <button 
              class="btn btn-secondary" 
              [routerLink]="['/membres', membre.id, 'edit']" 
              *ngIf="membre">
              <i class="bi bi-pencil"></i>
              Modifie
            </button>
            <button 
              class="btn btn-outline" 
              (click)="refreshAll()" 
              [disabled]="loading">
              <i class="bi bi-arrow-clockwise" [class.spinning]="loading"></i>
              Actualise
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading && !membre" class="loading-container">
        <div class="spinner"></div>
        <p>Chargement du profil...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="alert-error">
        <i class="bi bi-exclamation-triangle"></i>
        <div>
          <strong>Erreur</strong>
          <p>{{ error }}</p>
        </div>
        <button class="btn-close" (click)="error = ''">
          <i class="bi bi-x"></i>
        </button>
      </div>

      <!-- Main Content -->
      <div *ngIf="membre && !loading" class="profile-content">
        <!-- Profile Header Card -->
        <div class="profile-header-card">
          <div class="profile-avatar">
            <div class="avatar">
              <i class="bi bi-person"></i>
            </div>
            <div class="status-badge" [class]="'status-' + membre.etatCompte"></div>
          </div>
          <div class="profile-info">
            <h2>{{ membre.firstName }} {{ membre.lastName }}</h2>
            <div class="profile-meta">
              <span *ngIf="membre.email">
                <i class="bi bi-envelope"></i>
                {{ membre.email }}
              </span>
              <span *ngIf="membre.phone">
                <i class="bi bi-telephone"></i>
                {{ membre.phone }}
              </span>
              <span *ngIf="membre.matricule">
                <i class="bi bi-hash"></i>
                {{ membre.matricule }}
              </span>
            </div>
          </div>
          <div class="profile-badges">
            <span class="badge badge-primary">{{ getRoleLabel(membre.role) }}</span>
            <span class="badge" [class]="'badge-' + membre.etatCompte">
              {{ getEtatLabel(membre.etatCompte) }}
            </span>
            <span class="badge" 
                  [class.badge-success]="getAdhesionStatus() === 'VALIDE'"
                  [class.badge-warning]="getAdhesionStatus() === 'EN_ATTENTE'"
                  [class.badge-danger]="getAdhesionStatus() === 'REJETE'"
                  [class.badge-secondary]="getAdhesionStatus() === 'NONE'">
              {{ getAdhesionStatusLabel() }}
            </span>
          </div>
        </div>

        <!-- Content Grid -->
        <div class="content-grid">
          <!-- Left Column -->
          <div class="left-column">
            <!-- Informations Personnelles -->
            <div class="card">
              <div class="card-header">
                <h3><i class="bi bi-person-vcard"></i> Informations Personnelles</h3>
              </div>
              <div class="card-body">
                <div class="info-list">
                  <div class="info-item">
                    <label>Nom d'utilisateur</label>
                    <span>{{ membre.username }}</span>
                  </div>
                  <div class="info-item">
                    <label>Prénom</label>
                    <span>{{ membre.firstName }}</span>
                  </div>
                  <div class="info-item">
                    <label>Nom</label>
                    <span>{{ membre.lastName }}</span>
                  </div>
                  <div class="info-item">
                    <label>Fonction</label>
                    <span>{{ membre.fonction || 'Non renseignée' }}</span>
                  </div>
                  <div class="info-item" *ngIf="membre.matricule">
                    <label>Matricule</label>
                    <span>{{ membre.matricule }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Historique -->
            <div class="card">
              <div class="card-header">
                <h3><i class="bi bi-clock-history"></i> Historique</h3>
              </div>
              <div class="card-body">
                <div class="history-list">
                  <div class="history-item">
                    <div class="history-icon">
                      <i class="bi bi-plus-circle"></i>
                    </div>
                    <div class="history-content">
                      <strong>Inscription</strong>
                      <span>{{ formatDate(membre.dateRegistered) }}</span>
                    </div>
                  </div>
                  <div class="history-item" *ngIf="membre.dateAdhesion">
                    <div class="history-icon success">
                      <i class="bi bi-cash-coin"></i>
                    </div>
                    <div class="history-content">
                      <strong>Paiement Adhésion</strong>
                      <span>{{ formatDate(membre.dateAdhesion) }}</span>
                    </div>
                  </div>
                  <div class="history-item" *ngIf="membre.dateValidatedTresorerie">
                    <div class="history-icon info">
                      <i class="bi bi-check-circle"></i>
                    </div>
                    <div class="history-content">
                      <strong>Validation Trésorerie</strong>
                      <span>{{ formatDate(membre.dateValidatedTresorerie) }}</span>
                    </div>
                  </div>
                  <div class="history-item" *ngIf="membre.dateValidated">
                    <div class="history-icon warning">
                      <i class="bi bi-star"></i>
                    </div>
                    <div class="history-content">
                      <strong>Activation</strong>
                      <span>{{ formatDate(membre.dateValidated) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="actions-section" *ngIf="membre.etatCompte === 'EN_ATTENTE' || membre.etatCompte === 'VALIDE_PAR_TRESORERIE' || membre.etatCompte === 'ACTIF'">
                  <h4>Actions</h4>
                  <div class="action-buttons">
                    <button
                      *ngIf="membre.etatCompte === 'EN_ATTENTE'"
                      class="btn btn-info"
                      (click)="validerParTresorerie()">
                      Valider par trésorerie
                    </button>
                    <button
                      *ngIf="membre.etatCompte === 'VALIDE_PAR_TRESORERIE'"
                      class="btn btn-success"
                      (click)="validateMembre()">
                      Activer
                    </button>
                    <button
                      *ngIf="membre.etatCompte === 'ACTIF'"
                      class="btn btn-warning"
                      (click)="deactivateMembre()">
                      Désactiver
                    </button>
                    <button
                      *ngIf="estAdmin"
                      class="btn btn-outline-secondary"
                      (click)="reinitialiserMotDePasse()">
                      <i class="bi bi-key"></i> Réinitialiser le mot de passe
                    </button>
                    <div *ngIf="motDePasseProvisoire" class="alert alert-warning mt-3 w-100">
                      Mot de passe provisoire : <strong class="user-select-all">{{ motDePasseProvisoire }}</strong><br>
                      <small>Transmettez-le au membre (de vive voix, jamais par un groupe) ; il le changera dans son profil. Ce message ne sera plus affiché.</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div class="right-column">
            <!-- Solde -->
            <div class="card card-solde">
              <div class="card-header">
                <h3><i class="bi bi-wallet2"></i> Solde du Compte</h3>
              </div>
              <div class="card-body">
                <div class="solde-display">
                  <div>
                    <p class="solde-label">Solde actuel</p>
                    <div class="solde-amount">
                      <span class="solde-value">{{ formatMoney(solde) }}</span>
                      <span class="solde-currency">FCFA</span>
                    </div>
                  </div>
                  <button class="btn-icon" (click)="refreshSolde()" title="Actualiser">
                    <i class="bi bi-arrow-clockwise"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Adhésions -->
            <div class="card">
              <div class="card-header">
                <h3><i class="bi bi-cash-coin"></i> Adhésions</h3>
                <span class="badge-count" *ngIf="adhesions.length > 0">{{ adhesions.length }}</span>
              </div>
              <div class="card-body">
                <div *ngIf="loadingAdhesions" class="loading-inline">
                  <div class="spinner-small"></div>
                  <span>Chargement...</span>
                </div>
                <div *ngIf="!loadingAdhesions && adhesions.length === 0" class="empty-state">
                  <i class="bi bi-inbox"></i>
                  <p>Aucune adhésion</p>
                </div>
                <div class="list" *ngIf="!loadingAdhesions && adhesions.length > 0">
                  <div class="list-item" *ngFor="let adhesion of adhesions">
                    <div class="item-content">
                      <div class="item-header">
                        <strong>{{ formatMoney(adhesion.montant) }} FCFA</strong>
                        <span class="badge badge-sm"
                              [class.badge-warning]="adhesion.statut === 'EN_ATTENTE'"
                              [class.badge-success]="adhesion.statut === 'VALIDE'"
                              [class.badge-danger]="adhesion.statut === 'REJETE'">
                          {{ getStatutAdhesionLabel(adhesion.statut) }}
                        </span>
                      </div>
                      <div class="item-details">
                        <span><i class="bi bi-calendar"></i> {{ formatDate(adhesion.datePaiement) }}</span>
                        <span *ngIf="adhesion.modePaiement"><i class="bi bi-wallet2"></i> {{ adhesion.modePaiement }}</span>
                        <span *ngIf="adhesion.reference"><i class="bi bi-hash"></i> {{ adhesion.reference }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cotisations -->
            <div class="card">
              <div class="card-header">
                <h3><i class="bi bi-calendar-check"></i> Dernières Cotisations</h3>
                <span class="badge-count" *ngIf="cotisations.length > 0">{{ cotisations.length }}</span>
              </div>
              <div class="card-body">
                <div *ngIf="loadingCotisations" class="loading-inline">
                  <div class="spinner-small"></div>
                  <span>Chargement...</span>
                </div>
                <div *ngIf="!loadingCotisations && cotisations.length === 0" class="empty-state">
                  <i class="bi bi-inbox"></i>
                  <p>Aucune cotisation</p>
                </div>
                <div class="list" *ngIf="!loadingCotisations && cotisations.length > 0">
                  <div class="list-item" *ngFor="let cotisation of cotisations">
                    <div class="item-content">
                      <div class="item-header">
                        <strong>{{ cotisation.periode }}</strong>
                        <span class="badge badge-sm">{{ cotisation.statut }}</span>
                      </div>
                      <div class="item-details">
                        <span><i class="bi bi-cash-stack"></i> {{ formatMoney(cotisation.montant) }} FCFA</span>
                        <span><i class="bi bi-calendar"></i> {{ formatDate(cotisation.datePaiement) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="card-footer" *ngIf="cotisations.length > 0">
                  <a [routerLink]="['/cotisations']" [queryParams]="{membreId: membre.id}">
                    Voir toutes les cotisations <i class="bi bi-arrow-right"></i>
                  </a>
                </div>
              </div>
            </div>

            <!-- Prêts -->
            <div class="card">
              <div class="card-header">
                <h3><i class="bi bi-credit-card"></i> Prêts</h3>
                <span class="badge-count" *ngIf="prets.length > 0">{{ prets.length }}</span>
              </div>
              <div class="card-body">
                <div *ngIf="loadingPrets" class="loading-inline">
                  <div class="spinner-small"></div>
                  <span>Chargement...</span>
                </div>
                <div *ngIf="!loadingPrets && prets.length === 0" class="empty-state">
                  <i class="bi bi-inbox"></i>
                  <p>Aucun prêt</p>
                </div>
                <div class="list" *ngIf="!loadingPrets && prets.length > 0">
                  <div class="list-item" *ngFor="let pret of prets">
                    <div class="item-content">
                      <div class="item-header">
                        <strong>{{ formatMoney(pret.montant) }} FCFA</strong>
                        <span class="badge badge-sm">{{ pret.statut }}</span>
                      </div>
                      <div class="item-details">
                        <span><i class="bi bi-calendar-range"></i> {{ pret.duree }} mois</span>
                        <span><i class="bi bi-wallet2"></i> Reste: {{ formatMoney(pret.montantRestant) }} FCFA</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="card-footer" *ngIf="prets.length > 0">
                  <a [routerLink]="['/prets']" [queryParams]="{membreId: membre.id}">
                    Voir tous les prêts <i class="bi bi-arrow-right"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Container */
    .membre-profile-container {
      min-height: 100vh;
      background: #f8f9fa;
    }

    /* Header */
    .profile-header {
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
      gap: 20px;
    }

    .header-left {
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

    .header-title h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: #212529;
    }

    .header-title p {
      font-size: 14px;
      color: #6c757d;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 10px;
    }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background: #5a6268;
    }

    .btn-outline {
      background: white;
      color: #495057;
      border: 1px solid #dee2e6;
    }

    .btn-outline:hover {
      background: #f8f9fa;
    }

    .btn-info {
      background: #17a2b8;
      color: white;
    }

    .btn-info:hover {
      background: #138496;
    }

    .btn-success {
      background: #28a745;
      color: white;
    }

    .btn-success:hover {
      background: #218838;
    }

    .btn-warning {
      background: #ffc107;
      color: #212529;
    }

    .btn-warning:hover {
      background: #e0a800;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-icon {
      padding: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Loading */
    .loading-container {
      text-align: center;
      padding: 60px 20px;
      background: white;
      margin: 24px;
      border-radius: 8px;
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

    .alert-error i {
      font-size: 20px;
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

    /* Content */
    .profile-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    /* Profile Header Card */
    .profile-header-card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 24px;
      border: 1px solid #dee2e6;
    }

    .profile-avatar {
      position: relative;
    }

    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6c757d;
      font-size: 36px;
    }

    .status-badge {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
    }

    .status-ACTIF { background: #28a745; }
    .status-EN_ATTENTE { background: #ffc107; }
    .status-VALIDE_PAR_TRESORERIE { background: #17a2b8; }
    .status-VISITEUR { background: #6c757d; }
    .status-INACTIF { background: #dc3545; }

    .profile-info {
      flex: 1;
    }

    .profile-info h2 {
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #212529;
    }

    .profile-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 14px;
      color: #6c757d;
    }

    .profile-meta span {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .profile-meta i {
      color: #495057;
    }

    .profile-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Badges */
    .badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      display: inline-block;
    }

    .badge-primary {
      background: #e7f1ff;
      color: #004085;
    }

    .badge-ACTIF {
      background: #d4edda;
      color: #155724;
    }

    .badge-EN_ATTENTE {
      background: #fff3cd;
      color: #856404;
    }

    .badge-VALIDE_PAR_TRESORERIE {
      background: #d1ecf1;
      color: #0c5460;
    }

    .badge-VISITEUR {
      background: #e9ecef;
      color: #495057;
    }

    .badge-INACTIF {
      background: #f8d7da;
      color: #721c24;
    }

    .badge-success {
      background: #d4edda;
      color: #155724;
    }

    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }

    .badge-danger {
      background: #f8d7da;
      color: #721c24;
    }

    .badge-secondary {
      background: #e9ecef;
      color: #495057;
    }

    .badge-sm {
      padding: 2px 8px;
      font-size: 11px;
    }

    .badge-count {
      background: #495057;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    /* Grid */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .left-column,
    .right-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Cards */
    .card {
      background: white;
      border-radius: 8px;
      border: 1px solid #dee2e6;
      overflow: hidden;
    }

    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #dee2e6;
      background: #f8f9fa;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #212529;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-header i {
      color: #495057;
    }

    .card-body {
      padding: 20px;
    }

    .card-footer {
      padding: 12px 20px;
      border-top: 1px solid #dee2e6;
      background: #f8f9fa;
    }

    .card-footer a {
      color: #495057;
      text-decoration: none;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .card-footer a:hover {
      color: #212529;
    }

    .card-solde {
      background: #495057;
      color: white;
      border-color: #495057;
    }

    .card-solde .card-header {
      background: rgba(255, 255, 255, 0.1);
      border-bottom-color: rgba(255, 255, 255, 0.2);
    }

    .card-solde .card-header h3,
    .card-solde .card-header i {
      color: white;
    }

    /* Info List */
    .info-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
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

    /* History List */
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .history-item {
      display: flex;
      gap: 12px;
    }

    .history-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6c757d;
      flex-shrink: 0;
    }

    .history-icon.success {
      background: #d4edda;
      color: #155724;
    }

    .history-icon.info {
      background: #d1ecf1;
      color: #0c5460;
    }

    .history-icon.warning {
      background: #fff3cd;
      color: #856404;
    }

    .history-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .history-content strong {
      font-size: 14px;
      color: #212529;
    }

    .history-content span {
      font-size: 12px;
      color: #6c757d;
    }

    /* Actions */
    .actions-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
    }

    .actions-section h4 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #212529;
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Solde Display */
    .solde-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .solde-label {
      font-size: 14px;
      opacity: 0.9;
      margin: 0 0 8px 0;
    }

    .solde-amount {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .solde-value {
      font-size: 32px;
      font-weight: 700;
    }

    .solde-currency {
      font-size: 16px;
      opacity: 0.9;
    }

    /* List */
    .list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .list-item {
      padding: 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      background: #f8f9fa;
    }

    .item-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .item-header strong {
      font-size: 14px;
      color: #212529;
    }

    .item-details {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      color: #6c757d;
    }

    .item-details span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .item-details i {
      color: #495057;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 30px 20px;
      color: #6c757d;
    }

    .empty-state i {
      font-size: 40px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
    }

    /* Responsive */
    @media (max-width: 992px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .profile-header-card {
        flex-direction: column;
        align-items: flex-start;
      }

      .profile-badges {
        width: 100%;
      }
    }
  `]
})
export class MembreDetailComponent implements OnInit, OnDestroy {
  private dialog = inject(DialogService);
  private membreService = inject(MembreService);
  private cotisationService = inject(CotisationService);
  private pretService = inject(PretService);
  private adhesionService = inject(AdhesionService);
  private statsService = inject(StatsService);
  private authServ = inject(AuthService);
  motDePasseProvisoire = '';

  get estAdmin(): boolean {
    return this.authServ.hasRole('ADMIN');
  }

  async reinitialiserMotDePasse(): Promise<void> {
    if (!this.membre) return;
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: `Générer un nouveau mot de passe provisoire pour ${this.membre.firstName} ${this.membre.lastName} ? L'ancien ne fonctionnera plus.` })) return;
    this.motDePasseProvisoire = '';
    this.membreService.reinitialiserMotDePasse(this.membre.id).subscribe({
      next: (r) => this.motDePasseProvisoire = r.motDePasseProvisoire,
      error: (err) => this.dialog.erreur('Erreur : ' + (err.error?.message || err.message))
    });
  }
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  membre?: Membre;
  solde = 0;
  cotisations: Cotisation[] = [];
  prets: Pret[] = [];
  adhesions: Adhesion[] = [];

  loading = false;
  loadingCotisations = false;
  loadingPrets = false;
  loadingAdhesions = false;
  error = '';

  private refreshSubscription?: Subscription;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAllData(+id);
      
      // S'abonner aux notifications de rafraîchissement
      this.refreshSubscription = this.statsService.refreshStats$.subscribe(() => {
        if (this.membre) {
          this.loadSolde(this.membre.id);
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadAllData(id: number): void {
    this.loadMembre(id);
    this.loadSolde(id);
    this.loadCotisations(id);
    this.loadPrets(id);
    this.loadAdhesions(id);
  }

  refreshAll(): void {
    if (this.membre) {
      this.loadAllData(this.membre.id);
    }
  }

  loadMembre(id: number): void {
    this.loading = true;
    this.membreService.getById(id).subscribe({
      next: (membre) => {
        this.membre = membre;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement du membre: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  loadSolde(id: number): void {
    this.membreService.getSolde(id).subscribe({
      next: (response) => {
        this.solde = response.solde || 0;
      },
      error: () => {
        this.solde = 0;
      }
    });
  }

  refreshSolde(): void {
    if (this.membre) {
      this.loadSolde(this.membre.id);
    }
  }

  loadCotisations(membreId: number): void {
    this.loadingCotisations = true;
    this.cotisationService.getByMembre(membreId).subscribe({
      next: (cotisations) => {
        this.cotisations = cotisations.slice(0, 5);
        this.loadingCotisations = false;
      },
      error: () => {
        this.cotisations = [];
        this.loadingCotisations = false;
      }
    });
  }

  loadPrets(membreId: number): void {
    this.loadingPrets = true;
    this.pretService.getByMembre(membreId).subscribe({
      next: (prets) => {
        this.prets = prets.slice(0, 5);
        this.loadingPrets = false;
      },
      error: () => {
        this.prets = [];
        this.loadingPrets = false;
      }
    });
  }

  loadAdhesions(membreId: number): void {
    this.loadingAdhesions = true;
    this.adhesionService.getByMembreId(membreId).subscribe({
      next: (adhesions) => {
        this.adhesions = adhesions || [];
        // Trier par date de création (plus récent en dernier)
        this.adhesions.sort((a, b) => {
          const dateA = new Date(a.dateCreation || a.datePaiement || 0).getTime();
          const dateB = new Date(b.dateCreation || b.datePaiement || 0).getTime();
          return dateA - dateB;
        });
        this.loadingAdhesions = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des adhésions:', err);
        this.adhesions = [];
        this.loadingAdhesions = false;
      }
    });
  }

  async validerParTresorerie(): Promise<void> {
    if (!this.membre) return;

    if (await this.dialog.confirm({ titre: 'Confirmation', message: `Voulez-vous valider ce membre par la trésorerie ?\n${this.membre.firstName} ${this.membre.lastName}` })) {
      this.membreService.validerParTresorerie(this.membre.id).subscribe({
        next: () => {
          this.loadMembre(this.membre!.id);
          this.statsService.notifyRefresh();
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de la validation par trésorerie: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async validateMembre(): Promise<void> {
    if (!this.membre) return;

    if (await this.dialog.confirm({ titre: 'Confirmation', message: `Voulez-vous activer le compte de ce membre ?\n${this.membre.firstName} ${this.membre.lastName}` })) {
      this.membreService.validateMembre(this.membre.id).subscribe({
        next: () => {
          this.loadMembre(this.membre!.id);
          this.statsService.notifyRefresh();
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de l\'activation: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async deactivateMembre(): Promise<void> {
    if (!this.membre) return;

    if (await this.dialog.confirm({ titre: 'Désactiver ?', message: `Voulez-vous désactiver le membre ${this.membre.firstName} ${this.membre.lastName} ?`, danger: true, confirmer: 'Désactiver' })) {
      this.membreService.deactivateMembre(this.membre.id).subscribe({
        next: () => {
          this.loadMembre(this.membre!.id);
          this.statsService.notifyRefresh();
        },
        error: (err) => {
          this.dialog.erreur('Erreur lors de la désactivation: ' + (err.error?.message || err.message));
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

  getEtatIcon(etat: EtatCompte): string {
    const icons: Record<EtatCompte, string> = {
      [EtatCompte.VISITEUR]: 'bi-person-walking',
      [EtatCompte.EN_ATTENTE]: 'bi-clock-history',
      [EtatCompte.VALIDE_PAR_TRESORERIE]: 'bi-check2-circle',
      [EtatCompte.ACTIF]: 'bi-check-circle-fill',
      [EtatCompte.INACTIF]: 'bi-x-circle-fill'
    };
    return icons[etat] || 'bi-circle';
  }

  formatDate(date: string | Date): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount);
  }

  getAdhesionStatus(): 'VALIDE' | 'EN_ATTENTE' | 'REJETE' | 'NONE' {
    if (this.adhesions.length === 0) {
      return 'NONE';
    }
    // Prendre la dernière adhésion (la plus récente)
    const latestAdhesion = this.adhesions[this.adhesions.length - 1];
    return latestAdhesion.statut as 'VALIDE' | 'EN_ATTENTE' | 'REJETE';
  }

  getAdhesionStatusLabel(): string {
    const status = this.getAdhesionStatus();
    const labels: Record<string, string> = {
      'VALIDE': 'Payée',
      'EN_ATTENTE': 'En attente',
      'REJETE': 'Rejetée',
      'NONE': 'Non payée'
    };
    return labels[status] || 'Non payée';
  }

  getStatutAdhesionLabel(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': 'En attente',
      'VALIDE': 'Validée',
      'REJETE': 'Rejetée'
    };
    return labels[statut] || statut;
  }
}
