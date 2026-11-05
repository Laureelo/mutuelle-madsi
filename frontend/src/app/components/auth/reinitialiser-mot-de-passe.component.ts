import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Page ouverte depuis le lien reçu par email : choix d'un nouveau mot de passe. */
@Component({
  selector: 'app-reinitialiser-mot-de-passe',
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
        <h1 class="h4 text-center mb-3">Nouveau mot de passe</h1>

        <div *ngIf="termine" class="alert alert-success">
          <i class="bi bi-check-circle me-1"></i>{{ message }}
          <div class="mt-2"><a routerLink="/login" class="btn btn-envoyer btn-sm">Se connecter</a></div>
        </div>
        <div *ngIf="erreur" class="alert alert-danger small">{{ erreur }}
          <div class="mt-1"><a routerLink="/mot-de-passe-oublie">Refaire une demande</a></div>
        </div>

        <form (ngSubmit)="valider()" *ngIf="!termine">
          <div class="mb-3">
            <label class="form-label">Nouveau mot de passe</label>
            <input type="password" class="form-control" name="mdp" [(ngModel)]="mdp" autocomplete="new-password" required />
            <small class="text-muted">Au moins 8 caractères, avec au moins une lettre et un chiffre.</small>
          </div>
          <div class="mb-3">
            <label class="form-label">Confirmer le mot de passe</label>
            <input type="password" class="form-control" name="mdp2" [(ngModel)]="mdp2" autocomplete="new-password" required />
            <small class="text-danger" *ngIf="mdp2 && mdp !== mdp2">Les deux mots de passe sont différents.</small>
          </div>
          <button type="submit" class="btn btn-envoyer w-100" [disabled]="!mdp || mdp !== mdp2 || envoi">
            <span *ngIf="envoi" class="spinner-border spinner-border-sm me-1"></span>Enregistrer
          </button>
        </form>
      </div>
    </div>
  `
})
export class ReinitialiserMotDePasseComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  jeton = '';
  mdp = '';
  mdp2 = '';
  envoi = false;
  termine = false;
  message = '';
  erreur = '';

  ngOnInit(): void {
    this.jeton = this.route.snapshot.queryParamMap.get('jeton') || '';
    if (!this.jeton) this.erreur = 'Lien incomplet : ouvrez-le depuis le message reçu par email.';
  }

  valider(): void {
    if (!this.jeton) return;
    this.envoi = true;
    this.erreur = '';
    this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reinitialiser-mot-de-passe`, { jeton: this.jeton, motDePasse: this.mdp }).subscribe({
      next: (r) => { this.message = r.message; this.termine = true; this.envoi = false; },
      error: (err) => { this.erreur = err?.error?.message || 'Impossible de modifier le mot de passe.'; this.envoi = false; }
    });
  }
}
