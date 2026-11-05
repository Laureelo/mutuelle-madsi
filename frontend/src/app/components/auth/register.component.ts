import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MontantsService } from '../../services/montants.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <!-- Left Panel - Brand -->
      <div class="auth-left-panel">
        <div class="brand-content">
          <!-- Logo MADSI -->
          <div class="logo-madsi mb-4">
            <img src="/logo-madsi.jpeg" alt="MADSI Mutuelle" width="200" height="200" />
          </div>

          <p class="brand-description">Créez votre compte membre</p>

          <div class="info-box mt-4">
            <small>
              <i class="bi bi-info-circle me-2"></i>
              <strong>Statut initial :</strong> VISITEUR<br>
              <strong>Frais d'adhésion :</strong> {{ montants.adhesion | number:'1.0-0' }} FCFA
            </small>
          </div>
        </div>
      </div>

      <!-- Right Panel - Form -->
      <div class="auth-right-panel">
        <div class="form-container">
          <h1 class="form-title">Inscription à MADSI Mutuelle</h1>

          <p class="form-description">
            Créez votre compte pour rejoindre notre mutuelle. Après votre inscription avec le statut VISITEUR,
            vous pourrez effectuer votre paiement d'adhésion de {{ montants.adhesion | number:'1.0-0' }} FCFA pour devenir membre ACTIF.
          </p>

          <!-- Success Alert -->
          <div class="alert alert-success" *ngIf="successMessage">
            <i class="bi bi-check-circle me-2"></i>
            {{ successMessage }}
          </div>

          <!-- Error Alert -->
          <div class="alert alert-danger" *ngIf="errorMessage">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {{ errorMessage }}
          </div>

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <div class="row">
              <!-- Prénom -->
              <div class="col-md-6 mb-3">
                <input
                  type="text"
                  class="form-control form-input"
                  placeholder="Prénom"
                  formControlName="firstName"
                  [class.is-invalid]="registerForm.get('firstName')?.invalid && registerForm.get('firstName')?.touched"
                />
                <div class="invalid-feedback" *ngIf="registerForm.get('firstName')?.invalid && registerForm.get('firstName')?.touched">
                  Le prénom est requis
                </div>
              </div>

              <!-- Nom -->
              <div class="col-md-6 mb-3">
                <input
                  type="text"
                  class="form-control form-input"
                  placeholder="Nom"
                  formControlName="lastName"
                  [class.is-invalid]="registerForm.get('lastName')?.invalid && registerForm.get('lastName')?.touched"
                />
                <div class="invalid-feedback" *ngIf="registerForm.get('lastName')?.invalid && registerForm.get('lastName')?.touched">
                  Le nom est requis
                </div>
              </div>
            </div>

            <div class="row">
              <!-- Email -->
              <div class="col-md-6 mb-3">
                <input
                  type="email"
                  class="form-control form-input"
                  placeholder="Email"
                  formControlName="email"
                  [class.is-invalid]="registerForm.get('email')?.invalid && registerForm.get('email')?.touched"
                />
                <div class="invalid-feedback" *ngIf="registerForm.get('email')?.invalid && registerForm.get('email')?.touched">
                  <span *ngIf="registerForm.get('email')?.errors?.['required']">L'email est requis</span>
                  <span *ngIf="registerForm.get('email')?.errors?.['email']">Email invalide</span>
                </div>
              </div>

              <!-- Téléphone -->
              <div class="col-md-6 mb-3">
                <input
                  type="tel"
                  class="form-control form-input"
                  placeholder="Téléphone"
                  formControlName="phone"
                  [class.is-invalid]="registerForm.get('phone')?.invalid && registerForm.get('phone')?.touched"
                />
                <div class="invalid-feedback" *ngIf="registerForm.get('phone')?.invalid && registerForm.get('phone')?.touched">
                  Le téléphone est requis
                </div>
              </div>
            </div>

            <!-- Matricule Fonction Publique -->
            <div class="form-group mb-3">
              <input
                type="text"
                class="form-control form-input"
                placeholder="Matricule de la Fonction Publique (optionnel)"
                formControlName="matriculeFonctionPublique"
              />
              <small class="text-muted d-block mt-1" style="opacity: 0.8;">
                <i class="bi bi-info-circle me-1"></i>
                Si vous êtes fonctionnaire, saisissez votre matricule de la fonction publique
              </small>
            </div>

            <!-- Username -->
            <div class="form-group mb-3">
              <input
                type="text"
                class="form-control form-input"
                placeholder="Nom d'utilisateur"
                formControlName="username"
                [class.is-invalid]="registerForm.get('username')?.invalid && registerForm.get('username')?.touched"
              />
              <div class="invalid-feedback" *ngIf="registerForm.get('username')?.invalid && registerForm.get('username')?.touched">
                Le nom d'utilisateur est requis
              </div>
            </div>

            <div class="row">
              <!-- Password -->
              <div class="col-md-6 mb-3">
                <input
                  type="password"
                  class="form-control form-input"
                  placeholder="Mot de passe"
                  formControlName="password"
                  [class.is-invalid]="registerForm.get('password')?.invalid && registerForm.get('password')?.touched"
                />
                <div class="invalid-feedback" *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched">
                  <span *ngIf="registerForm.get('password')?.errors?.['required']">Le mot de passe est requis</span>
                  <span *ngIf="registerForm.get('password')?.errors?.['minlength']">Au moins 8 caractères</span>
                  <span *ngIf="registerForm.get('password')?.errors?.['pattern']">Doit contenir au moins une lettre et un chiffre</span>
                </div>
              </div>

              <!-- Confirm Password -->
              <div class="col-md-6 mb-3">
                <input
                  type="password"
                  class="form-control form-input"
                  placeholder="Confirmer le mot de passe"
                  formControlName="confirmPassword"
                  [class.is-invalid]="registerForm.get('confirmPassword')?.invalid && registerForm.get('confirmPassword')?.touched"
                />
                <div class="invalid-feedback" *ngIf="registerForm.get('confirmPassword')?.invalid && registerForm.get('confirmPassword')?.touched">
                  <span *ngIf="registerForm.get('confirmPassword')?.errors?.['required']">Confirmer le mot de passe</span>
                  <span *ngIf="registerForm.get('confirmPassword')?.errors?.['passwordMismatch']">Les mots de passe ne correspondent pas</span>
                </div>
              </div>
            </div>

            <!-- Terms -->
            <div class="form-check mb-4">
              <input
                type="checkbox"
                class="form-check-input"
                id="agreeTerms"
                formControlName="agreeTerms"
                [class.is-invalid]="registerForm.get('agreeTerms')?.invalid && registerForm.get('agreeTerms')?.touched"
              />
              <label class="form-check-label text-white" for="agreeTerms">
                J'accepte les conditions d'utilisation
              </label>
              <div class="invalid-feedback" *ngIf="registerForm.get('agreeTerms')?.invalid && registerForm.get('agreeTerms')?.touched">
                Vous devez accepter les conditions
              </div>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn btn-submit w-100 mb-3" [disabled]="registerForm.invalid || isLoading">
              <span *ngIf="!isLoading">S'INSCRIRE</span>
              <span *ngIf="isLoading">
                <span class="spinner-border spinner-border-sm me-2"></span>
                Inscription en cours...
              </span>
            </button>

            <div class="text-center">
              <span class="text-muted">Vous avez déjà un compte ?</span>
            </div>
            <div class="text-center mt-2">
              <button type="button" class="btn btn-outline-login" [routerLink]="['/login']">
                SE CONNECTER
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      min-height: 100vh;
      background: #f5f5f5;
    }

    .auth-left-panel {
      flex: 0 0 40%;
      background: #f8f9fa;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
    }

    .brand-content {
      max-width: 400px;
      text-align: center;
      color: #333;
    }

    .logo-madsi {
      display: flex;
      justify-content: center;
      margin-bottom: 1.5rem;
    }

    .logo-madsi img {
      max-width: 100%;
      height: auto;
    }

    .brand-description {
      font-size: 1.1rem;
      color: #2c3e50;
      margin-bottom: 0;
      font-weight: 500;
    }

    .info-box {
      background: rgba(61, 159, 168, 0.1);
      border-left: 3px solid #3d9fa8;
      padding: 1rem;
      border-radius: 4px;
      text-align: left;
      color: #555;
    }

    .auth-right-panel {
      flex: 1;
      background: linear-gradient(135deg, #3d9fa8 0%, #52b69a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      overflow-y: auto;
    }

    .form-container {
      max-width: 600px;
      width: 100%;
      color: white;
    }

    .form-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      line-height: 1.3;
    }

    .form-description {
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
      opacity: 0.95;
    }

    .form-input {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      backdrop-filter: blur(10px);
    }

    .form-input::placeholder {
      color: rgba(255, 255, 255, 0.7);
    }

    .form-input:focus {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
      color: white;
      box-shadow: 0 0 0 0.2rem rgba(255, 255, 255, 0.15);
    }

    .form-check-input {
      background-color: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .form-check-input:checked {
      background-color: #e89a3c;
      border-color: #e89a3c;
    }

    .btn-submit {
      background: linear-gradient(90deg, #2c8894 0%, #e89a3c 100%);
      border: none;
      color: white;
      padding: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .btn-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .btn-submit:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-outline-login {
      background: transparent;
      border: 2px solid white;
      color: white;
      padding: 0.75rem 2rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .btn-outline-login:hover {
      background: white;
      color: #2c8894;
    }

    .text-muted {
      color: rgba(255, 255, 255, 0.8) !important;
    }

    .alert {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 8px;
      backdrop-filter: blur(10px);
    }

    .invalid-feedback {
      color: #ffeb3b;
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }

    @media (max-width: 992px) {
      .auth-container {
        flex-direction: column;
      }

      .auth-left-panel {
        flex: 0 0 auto;
        padding: 2rem;
      }

      .auth-right-panel {
        flex: 1;
      }
    }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  montants = inject(MontantsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      matriculeFonctionPublique: [''], // Matricule de la fonction publique (optionnel)
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*[0-9]).+$/)]],
      confirmPassword: ['', Validators.required],
      agreeTerms: [false, Validators.requiredTrue]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const { confirmPassword, agreeTerms, ...registerData } = this.registerForm.value;
      // Ajouter le champ fonction avec une valeur par défaut
      const dataToSend = { ...registerData, fonction: 'Membre' };

      this.authService.register(dataToSend).subscribe({
        next: (response) => {
          console.log('Registration successful:', response);
          this.successMessage = 'Inscription réussie ! Votre compte a été créé avec le statut VISITEUR. Connectez-vous pour accéder au système et effectuer votre paiement d\'adhésion de 2 000 FCFA pour devenir membre actif.';

          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 4000);
        },
        error: (error) => {
          console.error('Registration error:', error);
          let errorMsg = 'Une erreur est survenue lors de l\'inscription';

          if (error?.error) {
            if (error.error.message) {
              errorMsg = error.error.message;
            } else if (error.error.error) {
              errorMsg = error.error.error;
            }
          } else if (error?.message) {
            errorMsg = error.message;
          }

          this.errorMessage = errorMsg;
          this.isLoading = false;
        }
      });
    }
  }
}
