import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ProfilService } from '../../services/profil.service';
import { Membre, MembreUpdate } from '../../models/membre.model';
import { LoginResponse } from '../../models/auth.model';
import { compresserImage } from '../../utils/image';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Content Header -->
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-6">
            <h3 class="mb-0">Mon Profil</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end">
              <li class="breadcrumb-item"><a href="#">Accueil</a></li>
              <li class="breadcrumb-item active">Mon Profil</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="app-content">
      <div class="container-fluid">

        <!-- Messages -->
        <div *ngIf="successMessage" class="alert alert-success alert-dismissible fade show" role="alert">
          <i class="bi bi-check-circle me-2"></i>{{ successMessage }}
          <button type="button" class="btn-close" (click)="successMessage = ''"></button>
        </div>
        <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
          <i class="bi bi-exclamation-triangle me-2"></i>{{ errorMessage }}
          <button type="button" class="btn-close" (click)="errorMessage = ''"></button>
        </div>

        <div class="row">
          <!-- Photo de profil -->
          <div class="col-md-4">
            <div class="card mb-4">
              <div class="card-header">
                <h3 class="card-title"><i class="bi bi-camera me-2"></i>Photo de profil</h3>
              </div>
              <div class="card-body text-center">
                <div class="profile-photo-container mb-3">
                  <img
                    *ngIf="membre?.photoUrl"
                    [src]="membre!.photoUrl"
                    alt="Photo de profil"
                    class="profile-photo"
                  />
                  <div *ngIf="!membre?.photoUrl" class="profile-photo-placeholder">
                    <i class="bi bi-person-circle"></i>
                  </div>
                </div>
                <input #fichierPhoto type="file" accept="image/jpeg,image/png,image/webp" class="d-none" (change)="onPhotoSelected($event)" />
                <button type="button" class="btn btn-outline-primary btn-sm" (click)="fichierPhoto.click()">
                  <i class="bi bi-upload me-1"></i>{{ membre?.photoUrl ? 'Changer la photo' : 'Ajouter une photo' }}
                </button>
                <button *ngIf="membre?.photoUrl" type="button" class="btn btn-outline-secondary btn-sm ms-1" (click)="supprimerPhoto()">
                  <i class="bi bi-trash me-1"></i>Retirer
                </button>
                <div><small class="text-muted">JPG, PNG ou WebP, 2 Mo au plus. La photo est réduite automatiquement.</small></div>
              </div>
            </div>

            <!-- Informations du compte -->
            <div class="card mb-4">
              <div class="card-header">
                <h3 class="card-title"><i class="bi bi-info-circle me-2"></i>Informations du compte</h3>
              </div>
              <div class="card-body">
                <div class="info-row">
                  <span class="info-label">Nom d'utilisateur</span>
                  <span class="info-value">{{ membre?.username }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Matricule</span>
                  <span class="info-value">{{ membre?.matricule || 'Non attribue' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Role</span>
                  <span class="info-value">
                    <span class="badge" [ngClass]="getRoleBadgeClass(membre?.role)">
                      {{ getRoleLabel(membre?.role) }}
                    </span>
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">Etat du compte</span>
                  <span class="info-value">
                    <span class="badge" [ngClass]="getEtatBadgeClass(membre?.etatCompte)">
                      {{ getEtatLabel(membre?.etatCompte) }}
                    </span>
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">Membre depuis</span>
                  <span class="info-value">{{ membre?.dateRegistered | date:'dd/MM/yyyy' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Formulaires -->
          <div class="col-md-8">
            <!-- Informations personnelles -->
            <div class="card mb-4">
              <div class="card-header">
                <h3 class="card-title"><i class="bi bi-person me-2"></i>Informations personnelles</h3>
              </div>
              <div class="card-body">
                <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label">Prenom <span class="text-danger">*</span></label>
                      <input
                        type="text"
                        class="form-control"
                        formControlName="firstName"
                        [ngClass]="{'is-invalid': profileForm.get('firstName')?.invalid && profileForm.get('firstName')?.touched}"
                      />
                      <div class="invalid-feedback" *ngIf="profileForm.get('firstName')?.errors?.['required']">
                        Le prenom est requis
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Nom <span class="text-danger">*</span></label>
                      <input
                        type="text"
                        class="form-control"
                        formControlName="lastName"
                        [ngClass]="{'is-invalid': profileForm.get('lastName')?.invalid && profileForm.get('lastName')?.touched}"
                      />
                      <div class="invalid-feedback" *ngIf="profileForm.get('lastName')?.errors?.['required']">
                        Le nom est requis
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Email <span class="text-danger">*</span></label>
                      <input
                        type="email"
                        class="form-control"
                        formControlName="email"
                        [ngClass]="{'is-invalid': profileForm.get('email')?.invalid && profileForm.get('email')?.touched}"
                      />
                      <div class="invalid-feedback" *ngIf="profileForm.get('email')?.errors?.['required']">
                        L'email est requis
                      </div>
                      <div class="invalid-feedback" *ngIf="profileForm.get('email')?.errors?.['email']">
                        Format d'email invalide
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Telephone</label>
                      <input
                        type="tel"
                        class="form-control"
                        formControlName="phone"
                        placeholder="+237 6XX XX XX XX"
                      />
                    </div>
                    <div class="col-md-12">
                      <label class="form-label">Fonction</label>
                      <input
                        type="text"
                        class="form-control"
                        [value]="membre?.fonction || 'Non definie'"
                        disabled
                      />
                      <small class="text-muted">La fonction est definie par l'administration</small>
                    </div>
                    <div class="col-md-12">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="notifEmail" formControlName="notificationsEmail" />
                        <label class="form-check-label" for="notifEmail">Recevoir les emails de rappel (cotisations, échéances de remboursement)</label>
                      </div>
                      <small class="text-muted">Les messages importants (validation, décision sur un prêt, mot de passe) vous parviennent toujours.</small>
                    </div>
                  </div>
                  <div class="mt-4">
                    <button
                      type="submit"
                      class="btn btn-primary"
                      [disabled]="profileForm.invalid || savingProfile"
                    >
                      <span *ngIf="savingProfile" class="spinner-border spinner-border-sm me-1"></span>
                      <i *ngIf="!savingProfile" class="bi bi-save me-1"></i>
                      {{ savingProfile ? 'Enregistrement...' : 'Enregistrer les modifications' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <!-- Changement de mot de passe -->
            <div class="card mb-4">
              <div class="card-header">
                <h3 class="card-title"><i class="bi bi-shield-lock me-2"></i>Securite - Changer le mot de passe</h3>
              </div>
              <div class="card-body">
                <form [formGroup]="passwordForm" (ngSubmit)="changePassword()">
                  <div class="row g-3">
                    <div class="col-md-12">
                      <label class="form-label">Mot de passe actuel <span class="text-danger">*</span></label>
                      <div class="input-group">
                        <input
                          [type]="showOldPassword ? 'text' : 'password'"
                          class="form-control"
                          formControlName="oldPassword"
                          [ngClass]="{'is-invalid': passwordForm.get('oldPassword')?.invalid && passwordForm.get('oldPassword')?.touched}"
                        />
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          (click)="showOldPassword = !showOldPassword"
                        >
                          <i [class]="showOldPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                        </button>
                      </div>
                      <div class="invalid-feedback d-block" *ngIf="passwordForm.get('oldPassword')?.errors?.['required'] && passwordForm.get('oldPassword')?.touched">
                        Le mot de passe actuel est requis
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Nouveau mot de passe <span class="text-danger">*</span></label>
                      <div class="input-group">
                        <input
                          [type]="showNewPassword ? 'text' : 'password'"
                          class="form-control"
                          formControlName="newPassword"
                          [ngClass]="{'is-invalid': passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched}"
                        />
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          (click)="showNewPassword = !showNewPassword"
                        >
                          <i [class]="showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                        </button>
                      </div>
                      <div class="invalid-feedback d-block" *ngIf="passwordForm.get('newPassword')?.errors?.['required'] && passwordForm.get('newPassword')?.touched">
                        Le nouveau mot de passe est requis
                      </div>
                      <div class="invalid-feedback d-block" *ngIf="passwordForm.get('newPassword')?.errors?.['minlength'] && passwordForm.get('newPassword')?.touched">
                        Le mot de passe doit contenir au moins 8 caracteres
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Confirmer le mot de passe <span class="text-danger">*</span></label>
                      <div class="input-group">
                        <input
                          [type]="showConfirmPassword ? 'text' : 'password'"
                          class="form-control"
                          formControlName="confirmPassword"
                          [ngClass]="{'is-invalid': (passwordForm.get('confirmPassword')?.invalid || passwordForm.errors?.['passwordMismatch']) && passwordForm.get('confirmPassword')?.touched}"
                        />
                        <button
                          type="button"
                          class="btn btn-outline-secondary"
                          (click)="showConfirmPassword = !showConfirmPassword"
                        >
                          <i [class]="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                        </button>
                      </div>
                      <div class="invalid-feedback d-block" *ngIf="passwordForm.get('confirmPassword')?.errors?.['required'] && passwordForm.get('confirmPassword')?.touched">
                        La confirmation est requise
                      </div>
                      <div class="invalid-feedback d-block" *ngIf="passwordForm.errors?.['passwordMismatch'] && passwordForm.get('confirmPassword')?.touched">
                        Les mots de passe ne correspondent pas
                      </div>
                    </div>
                  </div>
                  <div class="mt-4">
                    <button
                      type="submit"
                      class="btn btn-warning"
                      [disabled]="passwordForm.invalid || changingPassword"
                    >
                      <span *ngIf="changingPassword" class="spinner-border spinner-border-sm me-1"></span>
                      <i *ngIf="!changingPassword" class="bi bi-key me-1"></i>
                      {{ changingPassword ? 'Modification...' : 'Changer le mot de passe' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .profile-photo-container {
      width: 150px;
      height: 150px;
      margin: 0 auto;
      border-radius: 50%;
      overflow: hidden;
      border: 4px solid #3d9fa8;
      box-shadow: 0 4px 15px rgba(61, 159, 168, 0.3);
    }

    .profile-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-photo-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #3d9fa8 0%, #52b69a 100%);
      color: white;
    }

    .profile-photo-placeholder i {
      font-size: 5rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #eee;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      font-weight: 500;
      color: #6c757d;
    }

    .info-value {
      font-weight: 600;
      color: #2c3e50;
    }

    .card-header {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-bottom: 2px solid #3d9fa8;
    }

    .card-title {
      color: #2c3e50;
      font-size: 1.1rem;
      margin: 0;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3d9fa8 0%, #52b69a 100%);
      border: none;
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #358a92 0%, #469e87 100%);
    }

    .btn-warning {
      background: linear-gradient(135deg, #e89a3c 0%, #f0ad4e 100%);
      border: none;
      color: white;
    }

    .btn-warning:hover {
      background: linear-gradient(135deg, #d08830 0%, #e0a03e 100%);
      color: white;
    }
  `]
})
export class ProfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private profilService = inject(ProfilService);

  currentUser: LoginResponse | null = null;
  membre: Membre | null = null;

  profileForm: FormGroup;
  passwordForm: FormGroup;

  savingProfile = false;
  changingPassword = false;
  successMessage = '';
  errorMessage = '';

  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  constructor() {
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      notificationsEmail: [true]
    });

    this.passwordForm = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMembre();
  }

  loadMembre(): void {
    this.profilService.getMonProfil().subscribe({
      next: (membre) => {
        this.membre = membre;
        this.profileForm.patchValue({
          firstName: membre.firstName || '',
          lastName: membre.lastName || '',
          email: membre.email || '',
          phone: membre.phone || '',
          notificationsEmail: membre.notificationsEmail !== false
        });
      },
      error: (err) => {
        console.error('Erreur chargement profil:', err);
        this.errorMessage = 'Impossible de charger les informations du profil';
      }
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;

    this.savingProfile = true;
    this.successMessage = '';
    this.errorMessage = '';

    const updateData: MembreUpdate = {
      firstName: this.profileForm.value.firstName,
      lastName: this.profileForm.value.lastName,
      email: this.profileForm.value.email,
      phone: this.profileForm.value.phone,
      notificationsEmail: !!this.profileForm.value.notificationsEmail
    };

    this.profilService.updateMonProfil(updateData).subscribe({
      next: (updatedMembre) => {
        this.membre = updatedMembre;
        this.savingProfile = false;
        this.successMessage = 'Profil mis a jour avec succes';
      },
      error: (err) => {
        console.error('Erreur mise a jour profil:', err);
        this.savingProfile = false;
        this.errorMessage = err.error?.message || err.error?.error || 'Erreur lors de la mise a jour du profil';
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;

    this.changingPassword = true;
    this.successMessage = '';
    this.errorMessage = '';

    const passwordData = {
      oldPassword: this.passwordForm.value.oldPassword,
      newPassword: this.passwordForm.value.newPassword
    };

    this.profilService.changerMotDePasse(passwordData).subscribe({
      next: (response) => {
        this.changingPassword = false;
        this.successMessage = response.message || 'Mot de passe modifie avec succes';
        this.passwordForm.reset();
      },
      error: (err) => {
        console.error('Erreur changement mot de passe:', err);
        this.changingPassword = false;
        this.errorMessage = err.error?.message || err.error?.error || 'Erreur lors du changement de mot de passe. Verifiez votre mot de passe actuel.';
      }
    });
  }

  supprimerPhoto(): void {
    this.profilService.updateMonProfil({ photoUrl: '' }).subscribe({
      next: (m) => { this.membre = m; this.successMessage = 'Photo retirée'; },
      error: (err) => { this.errorMessage = err?.error?.message || 'Impossible de retirer la photo'; }
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Verifier la taille (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        this.errorMessage = 'La photo ne doit pas depasser 2 MB';
        return;
      }

      // Verifier le type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Veuillez selectionner une image valide';
        return;
      }

      // Réduire la photo en vignette (192 px) puis l'enregistrer
      this.errorMessage = '';
      compresserImage(file, 192, 0.85).then(
        (vignette) => {
          this.profilService.updateMonProfil({ photoUrl: vignette }).subscribe({
            next: (updatedMembre) => {
              this.membre = updatedMembre;
              this.successMessage = 'Photo de profil mise à jour';
            },
            error: (err) => {
              console.error('Erreur upload photo:', err);
              this.errorMessage = err?.error?.message || 'Erreur lors de la mise à jour de la photo';
            }
          });
        },
        (err) => { this.errorMessage = err?.message || 'Image illisible. Choisissez une photo JPG, PNG ou WebP.'; }
      );
    }
  }

  getRoleLabel(role: string | undefined): string {
    const labels: Record<string, string> = {
      'VISITEUR': 'Visiteur',
      'MEMBRE': 'Membre',
      'TRESORIER': 'Trésorier',
      'COMMISSAIRE': 'Commissaire aux comptes',
      'ADMIN': 'Administrateur'
    };
    return labels[role || ''] || role || 'Non defini';
  }

  getRoleBadgeClass(role: string | undefined): string {
    const classes: Record<string, string> = {
      'VISITEUR': 'bg-light text-dark',
      'MEMBRE': 'bg-secondary',
      'TRESORIER': 'bg-success',
      'COMMISSAIRE': 'bg-warning text-dark',
      'ADMIN': 'bg-primary'
    };
    return classes[role || ''] || 'bg-secondary';
  }

  getEtatLabel(etat: string | undefined): string {
    const labels: Record<string, string> = {
      'VISITEUR': 'Visiteur',
      'EN_ATTENTE': 'En attente',
      'VALIDE_PAR_TRESORERIE': 'Valide par tresorerie',
      'ACTIF': 'Actif',
      'INACTIF': 'Inactif'
    };
    return labels[etat || ''] || etat || 'Non defini';
  }

  getEtatBadgeClass(etat: string | undefined): string {
    const classes: Record<string, string> = {
      'VISITEUR': 'bg-secondary',
      'EN_ATTENTE': 'bg-warning text-dark',
      'VALIDE_PAR_TRESORERIE': 'bg-info',
      'ACTIF': 'bg-success',
      'INACTIF': 'bg-danger'
    };
    return classes[etat || ''] || 'bg-secondary';
  }
}
