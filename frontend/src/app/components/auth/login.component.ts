import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
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

          <p class="brand-description">Connectez-vous à votre espace membre</p>
        </div>
      </div>

      <!-- Right Panel - Form -->
      <div class="auth-right-panel">
        <div class="form-container">
          <h1 class="form-title">Bienvenue sur votre espace MADSI Mutuelle</h1>

          <p class="form-description">
            Connectez-vous pour accéder à votre tableau de bord, gérer vos cotisations mensuelles,
            consulter vos prestations et rester informé de toutes les activités de notre mutuelle.
          </p>

          <!-- Error Alert -->
          <div class="alert alert-danger" *ngIf="errorMessage">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {{ errorMessage }}
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <!-- Username -->
            <div class="form-group mb-3">
              <input
                type="text"
                class="form-control form-input"
                placeholder="Nom d'utilisateur"
                formControlName="username"
                [class.is-invalid]="loginForm.get('username')?.invalid && loginForm.get('username')?.touched"
              />
              <div class="invalid-feedback" *ngIf="loginForm.get('username')?.invalid && loginForm.get('username')?.touched">
                Le nom d'utilisateur est requis
              </div>
            </div>

            <!-- Password -->
            <div class="form-group mb-4">
              <input
                type="password"
                class="form-control form-input"
                placeholder="Mot de passe"
                formControlName="password"
                [class.is-invalid]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
              />
              <div class="invalid-feedback" *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched">
                Le mot de passe est requis
              </div>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn btn-submit w-100 mb-3" [disabled]="loginForm.invalid || isLoading">
              <span *ngIf="!isLoading">Se connecter</span>
              <span *ngIf="isLoading">
                <span class="spinner-border spinner-border-sm me-2"></span>
                Connexion...
              </span>
            </button>

            <div class="text-center mb-3">
              <a [routerLink]="['/mot-de-passe-oublie']" class="link-forgot">Mot de passe oublié ?</a>
            </div>

            <div class="text-center">
              <span class="text-muted">Vous n'avez pas de compte ?</span>
            </div>
            <div class="text-center mt-2">
              <button type="button" class="btn btn-outline-register" [routerLink]="['/register']">
                CRÉER DE NOUVELLES
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

    .auth-right-panel {
      flex: 1;
      background: linear-gradient(135deg, #3d9fa8 0%, #52b69a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
    }

    .form-container {
      max-width: 500px;
      width: 100%;
      color: white;
    }

    .form-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      line-height: 1.3;
    }

    .form-description {
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 2rem;
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

    .link-forgot {
      color: white;
      text-decoration: none;
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .link-forgot:hover {
      opacity: 1;
      text-decoration: underline;
    }

    .btn-outline-register {
      background: transparent;
      border: 2px solid white;
      color: white;
      padding: 0.75rem 2rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .btn-outline-register:hover {
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
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor() {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          console.error('Login error:', error);
          // Essayer d'extraire le message d'erreur du backend
          let errorMsg = 'Nom d\'utilisateur ou mot de passe incorrect';
          
          // Le backend renvoie une structure ApiError avec un champ 'message'
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
