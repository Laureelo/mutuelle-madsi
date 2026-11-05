import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { lienWhatsApp } from '../../utils/whatsapp';
import { DialogService } from '../../services/dialog.service';

/**
 * « Informer les membres » (trésorier, administrateur) : le message apparaît dans la cloche de chaque destinataire
 * et peut aussi partir par email. Pour WhatsApp (groupe de la mutuelle), on copie le message ou on ouvre WhatsApp.
 */
@Component({
  selector: 'app-annonces',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`.btn-wa { background: #25d366; color: #fff; border: 0; } .btn-wa:hover { background: #1ebe5b; color: #fff; }`],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <h3 class="mb-0"><i class="bi bi-chat-square-text me-2"></i>Informer les membres</h3>
        <small class="text-muted">Annonce, convocation, rappel : le message arrive dans la cloche de chaque membre, et par email si vous le souhaitez.</small>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <div class="row">
          <div class="col-lg-8">
            <div *ngIf="resultat" class="alert alert-success">
              <i class="bi bi-check-circle me-1"></i>Information envoyée à <strong>{{ resultat.destinataires }}</strong> membre(s).
              <span *ngIf="resultat.emailDemande && !resultat.emailsActifs" class="d-block small mt-1 text-warning-emphasis">
                Les emails ne sont pas actifs sur ce serveur (voir Paramètres) : le message est seulement dans l'application.
              </span>
            </div>
            <div *ngIf="erreur" class="alert alert-danger">{{ erreur }}</div>

            <div class="card">
              <div class="card-body">
                <form (ngSubmit)="envoyer()">
                  <div class="mb-3">
                    <label class="form-label">Destinataires</label>
                    <select class="form-select" name="audience" [(ngModel)]="audience">
                      <option value="TOUS">Tous les membres actifs</option>
                      <option value="BUREAU">Le bureau (président et trésoriers)</option>
                      <option value="EN_RETARD">Les membres en retard de cotisation</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Titre</label>
                    <input class="form-control" name="titre" [(ngModel)]="titre" maxlength="150" placeholder="Ex. : Assemblée générale du samedi 15" required />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Message</label>
                    <textarea class="form-control" name="message" rows="6" [(ngModel)]="message" maxlength="2000" required></textarea>
                    <small class="text-muted">{{ message.length }} / 2000 · Votre nom est ajouté en signature.</small>
                  </div>
                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="parEmail" name="parEmail" [(ngModel)]="parEmail" />
                    <label class="form-check-label" for="parEmail">Envoyer aussi par email</label>
                  </div>
                  <div class="d-flex flex-wrap gap-2">
                    <button type="submit" class="btn btn-primary" [disabled]="envoi || !titre.trim() || !message.trim()">
                      <span *ngIf="envoi" class="spinner-border spinner-border-sm me-1"></span>
                      <i *ngIf="!envoi" class="bi bi-send me-1"></i>Envoyer
                    </button>
                    <button type="button" class="btn btn-outline-secondary" (click)="copier()" [disabled]="!message.trim()">
                      <i class="bi bi-clipboard me-1"></i>{{ copie ? 'Copié' : 'Copier le message' }}
                    </button>
                    <a class="btn btn-wa" [class.disabled]="!message.trim()" [href]="lienWa()" target="_blank" rel="noopener">
                      <i class="bi bi-whatsapp me-1"></i>Ouvrir WhatsApp
                    </a>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AnnoncesComponent implements OnInit {
  private dialog = inject(DialogService);
  private service = inject(NotificationService);
  private route = inject(ActivatedRoute);

  audience = 'TOUS';
  titre = '';
  message = '';
  parEmail = true;
  envoi = false;
  copie = false;
  erreur = '';
  resultat: { destinataires: number; emailsActifs: boolean; emailDemande: boolean } | null = null;

  ngOnInit(): void {
    const a = this.route.snapshot.queryParamMap.get('audience');
    if (a === 'EN_RETARD' || a === 'BUREAU' || a === 'TOUS') this.audience = a;
    if (a === 'EN_RETARD') {
      this.titre = 'Rappel : cotisations à régler';
      this.message = 'Bonjour, il vous reste des mois de cotisation à régler. Vous pouvez déclarer votre paiement dans l\'application, rubrique Cotisations. Merci !';
    }
  }

  lienWa(): string {
    return lienWhatsApp(undefined, this.titre ? `${this.titre}\n\n${this.message}` : this.message) || '#';
  }

  copier(): void {
    navigator.clipboard?.writeText(this.titre ? `${this.titre}\n\n${this.message}` : this.message).then(() => {
      this.copie = true;
      setTimeout(() => this.copie = false, 2000);
    });
  }

  async envoyer(): Promise<void> {
    const libelle = { TOUS: 'tous les membres actifs', BUREAU: 'le bureau (président et trésoriers)', EN_RETARD: 'les membres en retard de cotisation' } as Record<string, string>;
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: `Envoyer cette information à ${libelle[this.audience]} ?` })) return;
    this.envoi = true;
    this.erreur = '';
    this.resultat = null;
    this.service.envoyerAnnonce({ titre: this.titre.trim(), message: this.message.trim(), audience: this.audience, parEmail: this.parEmail }).subscribe({
      next: (r) => { this.resultat = r; this.envoi = false; },
      error: (err) => { this.erreur = err?.error?.message || 'Envoi impossible.'; this.envoi = false; }
    });
  }
}
