import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, SettingsDTO } from '../../services/settings.service';
import { MontantsService } from '../../services/montants.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DialogService } from '../../services/dialog.service';

/**
 * Paramètres de la mutuelle (administrateur) : informations de l'organisation, montants fixés par le
 * règlement intérieur, seuils de confirmation du président et règles d'attribution.
 * Les valeurs sont enregistrées sur le serveur et utilisées partout dans l'application.
 */
@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-8">
            <h3 class="mb-0"><i class="bi bi-gear me-2"></i>Paramètres de la mutuelle</h3>
            <small class="text-muted">Réservé à l'administrateur. Les montants sont ceux du règlement intérieur ; seule l'Assemblée Générale peut les modifier.</small>
          </div>
          <div class="col-sm-4">
            <ol class="breadcrumb float-sm-end">
              <li class="breadcrumb-item"><a href="/dashboard">Accueil</a></li>
              <li class="breadcrumb-item active">Paramètres</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <div *ngIf="loading" class="text-center py-5"><div class="spinner-border text-primary"></div></div>

        <div *ngIf="message" class="alert alert-success alert-dismissible">
          <i class="bi bi-check-circle me-2"></i>{{ message }}
          <button type="button" class="btn-close" (click)="message = ''"></button>
        </div>
        <div *ngIf="error" class="alert alert-danger alert-dismissible">
          <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
          <button type="button" class="btn-close" (click)="error = ''"></button>
        </div>

        <form *ngIf="!loading && s" (ngSubmit)="enregistrer()">
          <!-- Organisation -->
          <div class="card mb-4">
            <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-building me-2"></i>Organisation</h5></div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Nom de la mutuelle</label>
                  <input class="form-control" name="nom" [(ngModel)]="s.organisation!.nom" required maxlength="100" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Devise</label>
                  <input class="form-control" name="devise" [(ngModel)]="s.organisation!.devise" maxlength="10" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Email de contact</label>
                  <input type="email" class="form-control" name="email" [(ngModel)]="s.organisation!.emailContact" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Téléphone de contact</label>
                  <input class="form-control" name="tel" [(ngModel)]="s.organisation!.phoneContact" />
                </div>
                <div class="col-12">
                  <label class="form-label">Adresse</label>
                  <input class="form-control" name="adresse" [(ngModel)]="s.organisation!.adresse" />
                </div>
              </div>
            </div>
          </div>

          <!-- Montants du règlement -->
          <div class="card mb-4">
            <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-cash-coin me-2"></i>Montants (règlement intérieur)</h5></div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Droit d'adhésion ({{ s.organisation!.devise || 'FCFA' }})</label>
                  <input type="number" min="1" class="form-control" name="adhesion" [(ngModel)]="s.finance!.montantAdhesion" required />
                  <small class="text-muted">Règlement intérieur, article 9 : 2 000 FCFA.</small>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Cotisation mensuelle ({{ s.organisation!.devise || 'FCFA' }})</label>
                  <input type="number" min="1" class="form-control" name="cotisation" [(ngModel)]="s.finance!.montantCotisation" required />
                  <small class="text-muted">Règlement intérieur, article 10 : 1 000 FCFA.</small>
                </div>
              </div>
              <div class="alert alert-info mt-3 mb-0 small">
                <i class="bi bi-info-circle me-1"></i>
                Les prêts de la mutuelle sont <strong>sans intérêt</strong> (statuts, article 3) : il n'y a donc pas de taux à régler.
              </div>
            </div>
          </div>

          <!-- Prêts et dépenses -->
          <div class="card mb-4">
            <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-person-check me-2"></i>Prêts, dépenses et confirmation du président</h5></div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Seuil de confirmation du président ({{ s.organisation!.devise || 'FCFA' }})</label>
                  <input type="number" min="1" class="form-control" name="seuil" [(ngModel)]="s.finance!.seuilConfirmationDepense" required />
                  <small class="text-muted">Au-delà de ce montant, une dépense ou un prêt doit être confirmé par le président (administrateur) avant d'être validé par le trésorier.</small>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Plafond de prêts non remboursés par membre ({{ s.organisation!.devise || 'FCFA' }})</label>
                  <input type="number" min="1" class="form-control" name="plafond" [(ngModel)]="s.finance!.plafondEncoursPrets" required />
                  <small class="text-muted">Ce qu'un membre doit encore, plus le nouveau prêt, ne peut pas dépasser ce plafond.</small>
                </div>
                <div class="col-12">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="aJour" name="aJour" [(ngModel)]="s.finance!.exigerCotisationsAJour" />
                    <label class="form-check-label" for="aJour">
                      Refuser un prêt ou une prestation aux membres qui ne sont pas à jour de leurs cotisations
                    </label>
                  </div>
                  <small class="text-muted">
                    <strong>Désactivé par défaut</strong> : c'est à chaque mutuelle d'en décider (règlement intérieur, articles 11 et 18).
                    Désactivée, la règle ne bloque personne, mais le nombre de mois impayés et le montant dû restent affichés
                    au membre, au trésorier et au président pour éclairer leur décision.
                  </small>
                </div>
              </div>
            </div>
          </div>

          <!-- Emails et rappels -->
          <div class="card mb-4">
            <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-envelope-at me-2"></i>Emails et rappels</h5></div>
            <div class="card-body">
              <div *ngIf="email" class="mb-3">
                <div class="alert mb-2" [class.alert-success]="email.actif" [class.alert-warning]="!email.actif">
                  <ng-container *ngIf="!email.configure">
                    <i class="bi bi-info-circle me-1"></i><strong>La messagerie n'est pas configurée.</strong>
                    L'application fonctionne normalement : les notifications restent dans l'application (la cloche).
                    Pour envoyer aussi des emails, renseignez <code>MAIL_HOST</code>, <code>MAIL_USERNAME</code> et <code>MAIL_PASSWORD</code>
                    dans <code>backend/.env</code> (voir le guide d'installation, section Gmail), puis redémarrez l'application.
                  </ng-container>
                  <ng-container *ngIf="email.configure && !email.autorise">
                    <i class="bi bi-pause-circle me-1"></i><strong>Les emails sont suspendus</strong> (interrupteur ci-dessous). Les notifications restent dans l'application.
                  </ng-container>
                  <ng-container *ngIf="email.actif">
                    <i class="bi bi-check-circle me-1"></i><strong>Les emails sont actifs.</strong>
                    Expéditeur : {{ email.expediteur }} · {{ email.envoyes7Jours }} envoyé(s) et {{ email.echecs7Jours }} échec(s) ces 7 derniers jours.
                  </ng-container>
                </div>
                <div *ngIf="email.derniersEchecs?.length" class="alert alert-danger small">
                  <strong>Derniers échecs :</strong>
                  <div *ngFor="let e of email.derniersEchecs">{{ e.date | date:'dd/MM HH:mm' }} · {{ e.adresse }} : {{ e.erreur }}</div>
                </div>
                <div class="d-flex flex-wrap gap-2 align-items-center">
                  <button type="button" class="btn btn-outline-primary btn-sm" (click)="tester()" [disabled]="testEnCours || !email.configure">
                    <span *ngIf="testEnCours" class="spinner-border spinner-border-sm me-1"></span>
                    <i *ngIf="!testEnCours" class="bi bi-send me-1"></i>Envoyer un message de test à mon adresse
                  </button>
                  <button type="button" class="btn btn-outline-secondary btn-sm" (click)="lancerRappels()">
                    <i class="bi bi-bell me-1"></i>Lancer les rappels du jour maintenant
                  </button>
                  <span *ngIf="retourEmail" class="small" [class.text-success]="retourEmail.ok" [class.text-danger]="!retourEmail.ok">{{ retourEmail.message }}</span>
                </div>
              </div>

              <div class="form-check form-switch mb-2">
                <input class="form-check-input" type="checkbox" id="emailsOn" name="emailsOn" [(ngModel)]="s.notifications!.canalEmailEnabled" />
                <label class="form-check-label" for="emailsOn">Envoyer des emails (en plus des notifications dans l'application)</label>
              </div>
              <div class="form-check form-switch mb-2">
                <input class="form-check-input" type="checkbox" id="rapCot" name="rapCot" [(ngModel)]="s.notifications!.rappelsCotisationsEnabled" />
                <label class="form-check-label" for="rapCot">Rappel mensuel (le 1er du mois) aux membres qui ont des cotisations impayées</label>
              </div>
              <div class="form-check form-switch mb-2">
                <input class="form-check-input" type="checkbox" id="rapEch" name="rapEch" [(ngModel)]="s.notifications!.rappelsEcheancesEnabled" />
                <label class="form-check-label" for="rapEch">Rappels d'échéances de remboursement (3 jours avant, le jour même, puis en cas de retard)</label>
              </div>
              <small class="text-muted">
                Les rappels sont envoyés chaque jour à 9 h tant que l'application est allumée. WhatsApp n'est jamais envoyé automatiquement :
                le trésorier utilise les boutons « WhatsApp » de la page Relances.
              </small>
            </div>
          </div>

          <!-- Reçus et annulations -->
          <div class="card mb-4">
            <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-receipt me-2"></i>Reçus et annulations</h5></div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Préfixe des numéros de reçu</label>
                  <input class="form-control" name="prefixe" [(ngModel)]="s.finance!.prefixRecu" maxlength="20" />
                  <small class="text-muted">Exemple : « MADSI- » donne des reçus numérotés MADSI-2026-000001.</small>
                </div>
                <div class="col-md-6 d-flex align-items-center">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="motifAnnul" name="motifAnnul" [(ngModel)]="s.finance!.motifAnnulationObligatoire" />
                    <label class="form-check-label" for="motifAnnul">Motif obligatoire pour annuler une opération</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="d-flex gap-2 mb-5">
            <button type="submit" class="btn btn-primary" [disabled]="saving">
              <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>
              <i *ngIf="!saving" class="bi bi-check-lg me-1"></i>Enregistrer les paramètres
            </button>
            <button type="button" class="btn btn-outline-secondary" (click)="reinitialiser()" [disabled]="saving">
              <i class="bi bi-arrow-counterclockwise me-1"></i>Revenir aux valeurs du règlement
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ParametresComponent implements OnInit {
  private dialog = inject(DialogService);
  private http = inject(HttpClient);
  email: any = null;
  testEnCours = false;
  retourEmail: { ok: boolean; message: string } | null = null;
  private settingsService = inject(SettingsService);
  private montants = inject(MontantsService);

  s: SettingsDTO | null = null;
  loading = true;
  saving = false;
  message = '';
  error = '';

  ngOnInit(): void {
    this.charger();
    this.chargerEmail();
  }

  chargerEmail(): void {
    this.http.get<any>(`${environment.apiUrl}/admin/email`).subscribe({
      next: (e) => this.email = e,
      error: () => this.email = null
    });
  }

  tester(): void {
    this.testEnCours = true;
    this.retourEmail = null;
    this.http.post<any>(`${environment.apiUrl}/admin/email/test`, {}).subscribe({
      next: (r) => { this.retourEmail = r; this.testEnCours = false; this.chargerEmail(); },
      error: (err) => { this.retourEmail = { ok: false, message: err?.error?.message || 'Échec du test.' }; this.testEnCours = false; }
    });
  }

  lancerRappels(): void {
    this.retourEmail = null;
    this.http.post<any>(`${environment.apiUrl}/admin/email/rappels`, {}).subscribe({
      next: (r) => this.retourEmail = { ok: true, message: `Rappels envoyés : ${r.echeances} échéance(s), ${r.cotisations} cotisation(s).` },
      error: (err) => this.retourEmail = { ok: false, message: err?.error?.message || 'Échec.' }
    });
  }

  private completer(dto: SettingsDTO): SettingsDTO {
    dto.organisation = dto.organisation ?? {};
    dto.finance = dto.finance ?? {};
    dto.notifications = dto.notifications ?? {};
    if (dto.notifications.canalEmailEnabled === undefined) dto.notifications.canalEmailEnabled = true;
    if (dto.notifications.rappelsCotisationsEnabled === undefined) dto.notifications.rappelsCotisationsEnabled = true;
    if (dto.notifications.rappelsEcheancesEnabled === undefined) dto.notifications.rappelsEcheancesEnabled = true;
    return dto;
  }

  charger(): void {
    this.loading = true;
    this.settingsService.get().subscribe({
      next: (dto) => { this.s = this.completer(dto); this.loading = false; },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger les paramètres.';
        this.loading = false;
      }
    });
  }

  enregistrer(): void {
    if (!this.s) return;
    const f = this.s.finance!;
    const positifs = [f.montantAdhesion, f.montantCotisation, f.seuilConfirmationDepense, f.plafondEncoursPrets];
    if (positifs.some(v => !v || v <= 0)) {
      this.error = 'Les montants doivent être supérieurs à 0.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.message = '';
    this.settingsService.update(this.s).subscribe({
      next: (dto) => {
        this.s = this.completer(dto);
        this.saving = false;
        this.message = 'Paramètres enregistrés. Ils s\'appliquent immédiatement à toute l\'application.';
        this.montants.charger();
        this.chargerEmail();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Échec de l\'enregistrement des paramètres.';
      }
    });
  }

  async reinitialiser(): Promise<void> {
    if (!await this.dialog.confirm({ titre: 'Confirmation', message: 'Revenir aux valeurs du règlement intérieur (cotisation 1 000 FCFA, adhésion 2 000 FCFA, seuils par défaut) ?' })) {
      return;
    }
    this.saving = true;
    this.error = '';
    this.settingsService.reset().subscribe({
      next: (dto) => {
        this.s = this.completer(dto);
        this.saving = false;
        this.message = 'Paramètres remis aux valeurs du règlement intérieur.';
        this.montants.charger();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Impossible de réinitialiser les paramètres.';
      }
    });
  }
}
