import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** « Mot de passe oublié » : un lien de réinitialisation est envoyé par email (valable une heure). */
@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  styles: [`
    .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f5f5; padding: 1rem; }
    .carte { width: 100%; max-width: 440px; background: #fff; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 2rem; }
    .btn-envoyer { background: #3d9fa8; color: #fff; border: 0; }
    .btn-envoyer:hover { background: #2f8c94; color: #fff; }
  `],
  template: `
    <div class="page">
      <div class="carte">
        <div class="text-center mb-3"><img src="/logo-madsi.jpeg" alt="MADSI" width="110" height="110" /></div>
        <h1 class="h4 text-center mb-2">Mot de passe oublié</h1>
        <p class="text-muted text-center small">
          Indiquez votre adresse email ou votre nom d'utilisateur : nous vous envoyons un lien pour choisir un nouveau mot de passe.
        </p>

        <div *ngIf="message" class="alert alert-success small"><i class="bi bi-envelope-check me-1"></i>{{ message }}</div>
        <div *ngIf="erreur" class="alert alert-danger small">{{ erreur }}</div>

        <form (ngSubmit)="envoyer()" *ngIf="!message">
          <input type="text" class="form-control mb-3" name="identifiant" [(ngModel)]="identifiant"
                 placeholder="Email ou nom d'utilisateur" required autocomplete="username" />
          <button type="submit" class="btn btn-envoyer w-100" [disabled]="!identifiant.trim() || envoi">
            <span *ngIf="envoi" class="spinner-border spinner-border-sm me-1"></span>Envoyer le lien
          </button>
        </form>

        <p class="small text-muted mt-3 mb-0">
          Pas d'email reçu ? Si la messagerie de la mutuelle n'est pas active, demandez à l'administrateur de réinitialiser
          votre mot de passe.
        </p>
        <div class="text-center mt-3"><a routerLink="/login">Retour à la connexion</a></div>
      </div>
    </div>
  `
})
export class MotDePasseOublieComponent {
  private http = inject(HttpClient);
  identifiant = '';
  envoi = false;
  message = '';
  erreur = '';

  envoyer(): void {
    this.envoi = true;
    this.erreur = '';
    this.http.post<{ message: string }>(`${environment.apiUrl}/auth/mot-de-passe-oublie`, { identifiant: this.identifiant.trim() }).subscribe({
      next: (r) => { this.message = r.message; this.envoi = false; },
      error: (err) => { this.erreur = err?.error?.message || 'Impossible de contacter le serveur.'; this.envoi = false; }
    });
  }
}
