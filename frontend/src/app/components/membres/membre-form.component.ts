import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MembreService } from '../../services/membre.service';
import { Membre, MembreCreate, MembreUpdate, EtatCompte, RoleMembre } from '../../models/membre.model';

@Component({
  selector: 'app-membre-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <!-- Content Header -->
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-6">
            <h3 class="mb-0">{{ isEditMode ? 'Modifier' : 'Nouveau' }} Membre</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end">
              <li class="breadcrumb-item"><a [routerLink]="['/dashboard']">Accueil</a></li>
              <li class="breadcrumb-item"><a [routerLink]="['/membres']">Membres</a></li>
              <li class="breadcrumb-item active">{{ isEditMode ? 'Modifier' : 'Nouveau' }}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="app-content">
      <div class="container-fluid">
        <!-- Loading State -->
        <div *ngIf="loading" class="card">
          <div class="card-body text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3">Chargement...</p>
          </div>
        </div>

        <!-- Error Alert -->
        <div *ngIf="error" class="alert alert-danger alert-dismissible fade show" role="alert">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
          <button type="button" class="btn-close" (click)="error = ''" aria-label="Close"></button>
        </div>

        <!-- Form -->
        <form [formGroup]="membreForm" (ngSubmit)="onSubmit()" *ngIf="!loading">
          <!-- Informations de connexion -->
          <div class="card mb-4">
            <div class="card-header">
              <h3 class="card-title"><i class="bi bi-key me-2"></i>Informations de connexion</h3>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="username" class="form-label">Nom d'utilisateur *</label>
                  <input
                    type="text"
                    id="username"
                    class="form-control"
                    formControlName="username"
                    [class.is-invalid]="isFieldInvalid('username')"
                  />
                  <div class="invalid-feedback" *ngIf="isFieldInvalid('username')">
                    Le nom d'utilisateur est requis
                  </div>
                </div>

                <div class="col-md-6 mb-3" *ngIf="!isEditMode">
                  <label for="password" class="form-label">Mot de passe *</label>
                  <input
                    type="password"
                    id="password"
                    class="form-control"
                    formControlName="password"
                    [class.is-invalid]="isFieldInvalid('password')"
                  />
                  <div class="invalid-feedback" *ngIf="isFieldInvalid('password')">
                    <span *ngIf="membreForm.get('password')?.errors?.['required']">Le mot de passe est requis</span>
                    <span *ngIf="membreForm.get('password')?.errors?.['minlength']">Le mot de passe doit contenir au moins 8 caractères, avec une lettre et un chiffre</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Informations personnelles -->
          <div class="card mb-4">
            <div class="card-header">
              <h3 class="card-title"><i class="bi bi-person me-2"></i>Informations personnelles</h3>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="matricule" class="form-label">Matricule MADSI</label>
                  <input
                    type="text"
                    id="matricule"
                    class="form-control"
                    formControlName="matricule"
                    maxlength="30"
                    placeholder="Ex: MEM001"
                  />
                  <small class="text-muted" *ngIf="isEditMode">
                    <i class="bi bi-info-circle me-1"></i>
                    Le matricule MADSI est généré automatiquement et ne peut pas être modifié
                  </small>
                </div>

                <div class="col-md-6 mb-3">
                  <label for="matriculeFonctionPublique" class="form-label">Matricule Fonction Publique</label>
                  <input
                    type="text"
                    id="matriculeFonctionPublique"
                    class="form-control"
                    formControlName="matriculeFonctionPublique"
                    maxlength="50"
                    placeholder="Ex: FP12345"
                  />
                  <small class="text-muted">
                    <i class="bi bi-info-circle me-1"></i>
                    Matricule attribué par la fonction publique
                  </small>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="firstName" class="form-label">Prénom *</label>
                  <input
                    type="text"
                    id="firstName"
                    class="form-control"
                    formControlName="firstName"
                    [class.is-invalid]="isFieldInvalid('firstName')"
                  />
                  <div class="invalid-feedback" *ngIf="isFieldInvalid('firstName')">
                    <span *ngIf="membreForm.get('firstName')?.errors?.['required']">Le prénom est requis</span>
                    <span *ngIf="membreForm.get('firstName')?.errors?.['maxlength']">Le prénom ne doit pas dépasser 50 caractères</span>
                  </div>
                </div>

                <div class="col-md-6 mb-3">
                  <label for="lastName" class="form-label">Nom *</label>
                  <input
                    type="text"
                    id="lastName"
                    class="form-control"
                    formControlName="lastName"
                    [class.is-invalid]="isFieldInvalid('lastName')"
                  />
                  <div class="invalid-feedback" *ngIf="isFieldInvalid('lastName')">
                    <span *ngIf="membreForm.get('lastName')?.errors?.['required']">Le nom est requis</span>
                    <span *ngIf="membreForm.get('lastName')?.errors?.['maxlength']">Le nom ne doit pas dépasser 50 caractères</span>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="email" class="form-label">Email *</label>
                  <input
                    type="email"
                    id="email"
                    class="form-control"
                    formControlName="email"
                    [class.is-invalid]="isFieldInvalid('email')"
                  />
                  <div class="invalid-feedback" *ngIf="isFieldInvalid('email')">
                    <span *ngIf="membreForm.get('email')?.errors?.['required']">L'email est requis</span>
                    <span *ngIf="membreForm.get('email')?.errors?.['email']">Un email valide est requis</span>
                  </div>
                </div>

                <div class="col-md-6 mb-3">
                  <label for="phone" class="form-label">Téléphone</label>
                  <input
                    type="tel"
                    id="phone"
                    class="form-control"
                    formControlName="phone"
                  />
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="fonction" class="form-label">Fonction</label>
                  <input
                    type="text"
                    id="fonction"
                    class="form-control"
                    formControlName="fonction"
                    placeholder="Ex: Enseignant, Directeur, etc."
                  />
                </div>

                <div class="col-md-6 mb-3">
                  <label for="photoUrl" class="form-label">URL Photo</label>
                  <input
                    type="url"
                    id="photoUrl"
                    class="form-control"
                    formControlName="photoUrl"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Statut et Rôle -->
          <div class="card mb-4">
            <div class="card-header">
              <h3 class="card-title"><i class="bi bi-shield-check me-2"></i>Statut et Rôle</h3>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="etatCompte" class="form-label">État du compte *</label>
                  <select
                    id="etatCompte"
                    class="form-select"
                    formControlName="etatCompte"
                    [class.is-invalid]="isFieldInvalid('etatCompte')"
                  >
                    <option value="">Sélectionner un état</option>
                    <option value="VISITEUR">Visiteur</option>
                    <option value="EN_ATTENTE">En attente</option>
                    <option value="VALIDE_PAR_TRESORERIE">Validé par trésorerie</option>
                    <option value="ACTIF">Actif</option>
                    <option value="INACTIF">Inactif</option>
                  </select>
                  <div class="invalid-feedback" *ngIf="isFieldInvalid('etatCompte')">
                    L'état du compte est requis
                  </div>
                </div>

                <div class="col-md-6 mb-3">
                  <label for="role" class="form-label">Rôle *</label>
                  <select
                    id="role"
                    class="form-select"
                    formControlName="role"
                    [class.is-invalid]="isFieldInvalid('role')"
                  >
                    <option value="">Sélectionner un rôle</option>
                    <option value="VISITEUR">Visiteur</option>
                    <option value="MEMBRE">Membre</option>
                    <option value="TRESORIER">Trésorier</option>
                    <option value="COMMISSAIRE">Commissaire aux comptes</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                  <div class="invalid-feedback" *ngIf="isFieldInvalid('role')">
                    Le rôle est requis
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="card">
            <div class="card-body">
              <div class="row">
                <div class="col-12">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    [disabled]="membreForm.invalid || submitting"
                  >
                    <span *ngIf="!submitting">
                      <i class="bi bi-save me-1"></i>{{ isEditMode ? 'Mettre à jour' : 'Créer' }}
                    </span>
                    <span *ngIf="submitting">
                      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Enregistrement...
                    </span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary ms-2"
                    [routerLink]="['/membres']"
                  >
                    <i class="bi bi-x-circle me-1"></i>Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: []
})
export class MembreFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private membreService = inject(MembreService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  membreForm!: FormGroup;
  isEditMode = false;
  membreId?: number;
  loading = false;
  submitting = false;
  error = '';

  ngOnInit(): void {
    this.initForm();
    this.checkEditMode();
  }

  initForm(): void {
    this.membreForm = this.fb.group({
      matricule: ['', Validators.maxLength(30)], // Matricule MADSI (généré automatiquement, non modifiable en édition)
      matriculeFonctionPublique: ['', Validators.maxLength(50)], // Matricule de la fonction publique (modifiable)
      username: ['', [Validators.required, Validators.maxLength(30)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*[0-9]).+$/)]],
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.maxLength(20)],
      fonction: ['', Validators.maxLength(80)],
      etatCompte: ['VISITEUR', Validators.required],
      role: ['VISITEUR', Validators.required],
      photoUrl: ['']
    });
  }

  checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.membreId = +id;
      this.membreForm.get('password')?.clearValidators();
      this.membreForm.get('password')?.updateValueAndValidity();
      this.loadMembre();
    }
  }

  loadMembre(): void {
    if (!this.membreId) return;

    this.loading = true;
    this.membreService.getById(this.membreId).subscribe({
      next: (membre: Membre) => {
        this.membreForm.patchValue({
          matricule: membre.matricule || '',
          matriculeFonctionPublique: membre.matriculeFonctionPublique || '',
          username: membre.username,
          firstName: membre.firstName,
          lastName: membre.lastName,
          email: membre.email,
          phone: membre.phone || '',
          fonction: membre.fonction || '',
          etatCompte: membre.etatCompte,
          role: membre.role,
          photoUrl: membre.photoUrl || ''
        });

        // Désactiver le matricule MADSI en mode édition (généré automatiquement)
        this.membreForm.get('matricule')?.disable();

        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement du membre: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.membreForm.invalid) {
      Object.keys(this.membreForm.controls).forEach(key => {
        this.membreForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.submitting = true;
    this.error = '';

    const formValue = this.membreForm.value;

    if (this.isEditMode && this.membreId) {
      const updateData: MembreUpdate = {
        // Note: matricule MADSI n'est pas inclus car il ne peut pas être modifié par l'admin
        username: formValue.username?.trim() || undefined,
        firstName: formValue.firstName?.trim() || undefined,
        lastName: formValue.lastName?.trim() || undefined,
        email: formValue.email?.trim().toLowerCase() || undefined,
        phone: formValue.phone?.trim() || undefined,
        matriculeFonctionPublique: formValue.matriculeFonctionPublique?.trim() || undefined,
        fonction: formValue.fonction?.trim() || undefined,
        etatCompte: formValue.etatCompte,
        role: formValue.role,
        photoUrl: formValue.photoUrl?.trim() || undefined
      };

      this.membreService.update(this.membreId, updateData).subscribe({
        next: () => {
          this.router.navigate(['/membres']);
        },
        error: (err) => {
          this.error = 'Erreur lors de la mise à jour: ' + (err.error?.message || err.message);
          this.submitting = false;
        }
      });
    } else {
      // Préparer les données pour l'envoi selon le DTO backend
      const createData: MembreCreate = {
        username: formValue.username.trim(),
        password: formValue.password,
        firstName: formValue.firstName.trim(),
        lastName: formValue.lastName.trim(),
        email: formValue.email.trim().toLowerCase(),
        phone: formValue.phone?.trim() || undefined,
        matriculeFonctionPublique: formValue.matriculeFonctionPublique?.trim() || undefined,
        fonction: formValue.fonction?.trim() || undefined,
        role: formValue.role || RoleMembre.MEMBRE,
        etatCompte: formValue.etatCompte || EtatCompte.EN_ATTENTE
      };

      // Validation supplémentaire avant envoi
      if (!createData.username || createData.username.length === 0) {
        this.error = 'Le nom d\'utilisateur est requis';
        this.submitting = false;
        return;
      }

      if (!createData.email || createData.email.length === 0) {
        this.error = 'L\'email est requis';
        this.submitting = false;
        return;
      }

      if (!createData.password || createData.password.length < 8) {
        this.error = 'Le mot de passe doit contenir au moins 8 caractères, avec une lettre et un chiffre';
        this.submitting = false;
        return;
      }

      this.membreService.create(createData).subscribe({
        next: () => {
          this.router.navigate(['/membres']);
        },
        error: (err) => {
          this.submitting = false;
          this.handleCreateError(err);
        }
      });
    }
  }

  private handleCreateError(err: any): void {
    let errorMessage = 'Erreur lors de la création du membre';
    
    // Extraire le message d'erreur
    if (err.error?.message) {
      errorMessage = err.error.message;
    } else if (err.error?.error) {
      errorMessage = err.error.error;
    } else if (err.message) {
      errorMessage = err.message;
    }

    // Messages d'erreur spécifiques et clairs
    if (errorMessage.includes('username déjà pris') || errorMessage.includes('username')) {
      errorMessage = 'Ce nom d\'utilisateur est déjà utilisé. Veuillez en choisir un autre.';
      this.membreForm.get('username')?.setErrors({ 'duplicate': true });
    } else if (errorMessage.includes('email déjà utilisé') || errorMessage.includes('email')) {
      errorMessage = 'Cet email est déjà utilisé. Veuillez utiliser un autre email.';
      this.membreForm.get('email')?.setErrors({ 'duplicate': true });
    } else if (errorMessage.includes('matricule')) {
      errorMessage = 'Ce matricule est déjà utilisé.';
    } else if (errorMessage.includes('Contrainte') || errorMessage.includes('constraint') || errorMessage.includes('DATA_INTEGRITY_VIOLATION')) {
      errorMessage = 'Données invalides : vérifiez que le nom d\'utilisateur et l\'email sont uniques.';
    } else if (errorMessage.includes('VALIDATION_ERROR') || err.error?.messages) {
      // Erreurs de validation Bean Validation
      const messages = err.error.messages || [];
      errorMessage = 'Erreurs de validation : ' + messages.join(', ');
    } else if (errorMessage.includes('password trop court')) {
      errorMessage = 'Le mot de passe doit contenir au moins 8 caractères, avec une lettre et un chiffre.';
      this.membreForm.get('password')?.setErrors({ 'minlength': true });
    } else if (errorMessage.includes('username requis') || errorMessage.includes('email requis')) {
      errorMessage = 'Tous les champs obligatoires doivent être remplis.';
    }
    
    this.error = errorMessage;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.membreForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
