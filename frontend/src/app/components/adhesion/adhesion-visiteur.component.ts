import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AdhesionService } from '../../services/adhesion.service';
import { Adhesion, StatutAdhesion } from '../../models/adhesion.model';
import { ModePaiement } from '../../models/cotisation.model';
import { AuthService } from '../../services/auth.service';
import { MontantsService } from '../../services/montants.service';
import { RecuService } from '../../services/recu.service';
import { compresserImage } from '../../utils/image';

@Component({
  selector: 'app-adhesion-visiteur',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-6">
            <h3 class="mb-0">Mon Adhésion MADSI</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end">
              <li class="breadcrumb-item"><a href="#">Accueil</a></li>
              <li class="breadcrumb-item active">Adhésion</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <!-- Alerte principale -->
        <div class="alert alert-warning alert-dismissible" *ngIf="!adhesionValidee">
          <h5><i class="bi bi-exclamation-triangle me-2"></i>Adhésion requise</h5>
          <p class="mb-0">
            Votre compte a le statut <strong>VISITEUR</strong>. Pour devenir membre actif de MADSI et
            accéder à toutes les fonctionnalités, vous devez payer vos frais d'adhésion de <strong>{{ montants.adhesion | number:'1.0-0' }} FCFA</strong>.
          </p>
        </div>

        <!-- Statut de l'adhésion -->
        <div class="row" *ngIf="mesAdhesions.length > 0">
          <div class="col-12">
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="card-title mb-0">
                  <i class="bi bi-info-circle me-2"></i>État de mon adhésion
                </h5>
              </div>
              <div class="card-body">
                <div *ngFor="let adhesion of mesAdhesions" class="mb-3">
                  <div class="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 class="mb-1">
                        Paiement de {{ adhesion.montant | number:'1.0-0' }} FCFA
                      </h6>
                      <small class="text-muted">
                        {{ adhesion.modePaiement }}
                        <span *ngIf="adhesion.reference">- Réf: {{ adhesion.reference }}</span>
                      </small>
                      <p class="mb-0 mt-1" *ngIf="adhesion.remarque">
                        <small><em>{{ adhesion.remarque }}</em></small>
                      </p>
                      <p class="mb-0 mt-1" *ngIf="adhesion.aPreuve || adhesion.photoPreuve">
                        <small class="text-success">
                          <i class="bi bi-paperclip me-1"></i>Preuve de paiement jointe
                        </small>
                      </p>
                    </div>
                    <div>
                      <span class="badge"
                            [class.text-bg-warning]="adhesion.statut === 'EN_ATTENTE'"
                            [class.text-bg-success]="adhesion.statut === 'VALIDE'"
                            [class.text-bg-danger]="adhesion.statut === 'REJETE'">
                        {{ getStatutLabel(adhesion.statut) }}
                      </span>
                    </div>
                  </div>

                  <!-- Message selon le statut -->
                  <div class="alert mt-2 mb-0"
                       [class.alert-info]="adhesion.statut === 'EN_ATTENTE'"
                       [class.alert-success]="adhesion.statut === 'VALIDE'"
                       [class.alert-danger]="adhesion.statut === 'REJETE'">
                    <small>
                      <span *ngIf="adhesion.statut === 'EN_ATTENTE'">
                        <i class="bi bi-hourglass-split me-1"></i>
                        <strong>Important :</strong> Votre paiement est en cours de vérification par la trésorerie. 
                        La trésorerie ne sera mise à jour qu'après validation de votre paiement par le trésorier. 
                        Vous serez notifié une fois validé.
                      </span>
                      <span *ngIf="adhesion.statut === 'VALIDE'">
                        <i class="bi bi-check-circle me-1"></i>
                        Votre paiement a été validé par la trésorerie. Votre compte sera activé prochainement par
                        l'administrateur : vous aurez alors accès à toutes les fonctionnalités.
                        <button *ngIf="adhesion.operationId" type="button" class="btn btn-sm btn-outline-success ms-2" (click)="recus.ouvrirOperation(adhesion.operationId)" title="Télécharger le reçu"><i class="bi bi-file-earmark-pdf"></i> Reçu</button>
                      </span>
                      <span *ngIf="adhesion.statut === 'REJETE'">
                        <i class="bi bi-x-circle me-1"></i>
                        Votre paiement a été rejeté. Motif : {{ adhesion.motifRejet || 'Non spécifié' }}
                      </span>
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Formulaire de déclaration -->
        <div class="row" *ngIf="!adhesionEnAttente && !adhesionValidee">
          <div class="col-md-8 offset-md-2">
            <div class="card">
              <div class="card-header bg-primary text-white">
                <h5 class="card-title mb-0">
                  <i class="bi bi-cash-coin me-2"></i>Déclarer mon paiement d'adhésion
                </h5>
              </div>
              <div class="card-body">
                <!-- Info montant -->
                <div class="alert alert-info">
                  <strong>Montant de l'adhésion :</strong> {{ montants.adhesion | number:'1.0-0' }} FCFA
                </div>

                <!-- Messages d'erreur/succès -->
                <div class="alert alert-success alert-dismissible" *ngIf="successMessage">
                  <button type="button" class="btn-close" (click)="successMessage = ''" aria-label="Close"></button>
                  {{ successMessage }}
                </div>

                <div class="alert alert-danger alert-dismissible" *ngIf="errorMessage">
                  <button type="button" class="btn-close" (click)="errorMessage = ''" aria-label="Close"></button>
                  {{ errorMessage }}
                </div>

                <!-- Formulaire -->
                <form [formGroup]="adhesionForm" (ngSubmit)="onSubmit()">
                  <!-- Mode de paiement -->
                  <div class="mb-3">
                    <label for="modePaiement" class="form-label">Mode de paiement <span class="text-danger">*</span></label>
                    <select
                      id="modePaiement"
                      class="form-select"
                      formControlName="modePaiement"
                      [class.is-invalid]="adhesionForm.get('modePaiement')?.invalid && adhesionForm.get('modePaiement')?.touched">
                      <option value="">Sélectionnez un mode</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="ESPECES">Espèces</option>
                    </select>
                    <div class="invalid-feedback" *ngIf="adhesionForm.get('modePaiement')?.invalid && adhesionForm.get('modePaiement')?.touched">
                      Le mode de paiement est requis
                    </div>
                  </div>

                  <!-- Référence -->
                  <div class="mb-3">
                    <label for="reference" class="form-label">Référence de transaction</label>
                    <input
                      type="text"
                      id="reference"
                      class="form-control"
                      formControlName="reference"
                      placeholder="Ex: Transaction #123456789">
                    <small class="form-text text-muted">
                      Numéro de transaction Mobile Money ou autre référence
                    </small>
                  </div>

                  <!-- Remarque -->
                  <div class="mb-3">
                    <label for="remarque" class="form-label">Remarque (optionnel)</label>
                    <textarea
                      id="remarque"
                      class="form-control"
                      formControlName="remarque"
                      rows="3"
                      placeholder="Informations complémentaires sur le paiement"></textarea>
                  </div>

                  <!-- Upload de fichier -->
                  <div class="mb-3">
                    <label for="photoPreuve" class="form-label">
                      Preuve de paiement (optionnel)
                      <i class="bi bi-info-circle ms-1" title="Capture d'écran ou document du paiement"></i>
                    </label>
                    <div class="input-group">
                      <input
                        type="file"
                        class="form-control"
                        id="photoPreuve"
                        accept="image/*"
                        (change)="onFileSelected($event)">
                      <button
                        *ngIf="selectedFileName"
                        class="btn btn-outline-danger"
                        type="button"
                        (click)="removeFile()"
                        title="Supprimer le fichier">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    </div>
                    <small class="form-text text-muted">
                      Photo ou capture d'écran (JPG, PNG, WebP, max 5 Mo), réduite automatiquement
                    </small>
                    <div *ngIf="selectedFileName" class="mt-2">
                      <small class="text-success">
                        <i class="bi bi-check-circle me-1"></i>
                        Fichier sélectionné : {{ selectedFileName }}
                      </small>
                    </div>
                  </div>

                  <!-- Boutons -->
                  <div class="d-grid gap-2">
                    <button
                      type="submit"
                      class="btn btn-primary"
                      [disabled]="adhesionForm.invalid || isLoading">
                      <span *ngIf="!isLoading">
                        <i class="bi bi-check-circle me-2"></i>Déclarer mon paiement
                      </span>
                      <span *ngIf="isLoading">
                        <span class="spinner-border spinner-border-sm me-2"></span>
                        Enregistrement en cours...
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <!-- Message si adhésion en attente -->
        <div class="row" *ngIf="adhesionEnAttente && !adhesionValidee">
          <div class="col-md-8 offset-md-2">
            <div class="card border-warning">
              <div class="card-body text-center">
                <i class="bi bi-hourglass-split text-warning" style="font-size: 3rem;"></i>
                <h5 class="mt-3">Paiement en cours de vérification</h5>
                <p class="text-muted">
                  Votre déclaration de paiement a bien été enregistrée.
                  Le trésorier vérifiera votre paiement et validera votre adhésion sous peu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AdhesionVisiteurComponent implements OnInit {
  private fb = inject(FormBuilder);
  montants = inject(MontantsService);
  recus = inject(RecuService);
  private adhesionService = inject(AdhesionService);
  private router = inject(Router);
  private authService = inject(AuthService);

  adhesionForm: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  selectedFile: File | null = null;
  selectedFileName = '';

  mesAdhesions: Adhesion[] = [];

  constructor() {
    this.adhesionForm = this.fb.group({
      modePaiement: ['', Validators.required],
      reference: [''],
      remarque: [''],
      photoPreuve: ['']
    });
  }

  ngOnInit(): void {
    // Rediriger les trésoriers/admin vers la page trésorier
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.roles) {
      const isTresorierOrAdmin = currentUser.roles.some(role =>
        ['TRESORIER', 'ADMIN'].includes(role)
      );
      if (isTresorierOrAdmin) {
        this.router.navigate(['/adhesion/tresorier']);
        return;
      }
    }

    this.loadMesAdhesions();
  }

  loadMesAdhesions(): void {
    this.adhesionService.getMesAdhesions().subscribe({
      next: (adhesions) => {
        this.mesAdhesions = adhesions;
      },
      error: (err) => {
        console.error('Erreur chargement adhésions:', err);
      }
    });
  }

  get adhesionEnAttente(): boolean {
    return this.mesAdhesions.some(a => a.statut === StatutAdhesion.EN_ATTENTE);
  }

  get adhesionValidee(): boolean {
    return this.mesAdhesions.some(a => a.statut === StatutAdhesion.VALIDE);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Seules les images sont acceptées (capture d'écran ou photo du reçu)
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Type de fichier non autorisé. Veuillez sélectionner une image (JPG, PNG, WebP).';
        return;
      }

      // Vérifier la taille (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.errorMessage = 'Le fichier est trop volumineux. Taille maximale : 5 MB.';
        return;
      }

      this.selectedFile = file;
      this.selectedFileName = file.name;
      this.errorMessage = '';

      // Réduire la photo (taille et poids) avant envoi
      compresserImage(file).then(
        (image) => { this.adhesionForm.patchValue({ photoPreuve: image }); },
        (err) => {
          this.errorMessage = err?.message || 'Image illisible. Choisissez une photo JPG, PNG ou WebP.';
          this.removeFile();
        }
      );
    }
  }

  removeFile(): void {
    this.selectedFile = null;
    this.selectedFileName = '';
    this.adhesionForm.patchValue({ photoPreuve: '' });
  }

  onSubmit(): void {
    if (this.adhesionForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      this.adhesionService.declarer(this.adhesionForm.value).subscribe({
        next: (response) => {
          this.successMessage = 'Votre paiement d\'adhésion a été déclaré avec succès ! ' +
            'Le trésorier vérifiera votre paiement et validera votre adhésion.';
          this.adhesionForm.reset();
          this.selectedFile = null;
          this.selectedFileName = '';
          this.isLoading = false;

          // Recharger les adhésions
          setTimeout(() => {
            this.loadMesAdhesions();
          }, 1000);
        },
        error: (err) => {
          console.error('Erreur déclaration adhésion:', err);
          this.errorMessage = err.error?.message || err.error?.error || 'Une erreur est survenue lors de la déclaration';
          this.isLoading = false;
        }
      });
    }
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': 'En attente',
      'VALIDE': 'Validé',
      'REJETE': 'Rejeté'
    };
    return labels[statut] || statut;
  }
}
