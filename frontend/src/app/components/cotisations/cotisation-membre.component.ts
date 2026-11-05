import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CotisationService } from '../../services/cotisation.service';
import { AuthService } from '../../services/auth.service';
import { Cotisation, DeclarerCotisationInput, ModePaiement, StatutCotisation } from '../../models/cotisation.model';
import { MontantsService } from '../../services/montants.service';
import { RecuService } from '../../services/recu.service';

@Component({
  selector: 'app-cotisation-membre',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row align-items-center">
          <div class="col-sm-6">
            <h3 class="mb-0"><i class="bi bi-wallet2 me-2"></i>Mes Cotisations</h3>
          </div>
          <div class="col-sm-6">
            <ol class="breadcrumb float-sm-end mb-0">
              <li class="breadcrumb-item"><a href="#" (click)="$event.preventDefault()">Accueil</a></li>
              <li class="breadcrumb-item active">Cotisations</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <!-- Messages -->
        <div class="alert alert-success alert-dismissible fade show" *ngIf="successMessage">
          <i class="bi bi-check-circle me-2"></i>{{ successMessage }}
          <button type="button" class="btn-close" (click)="successMessage = ''" aria-label="Close"></button>
        </div>

        <div class="alert alert-danger alert-dismissible fade show" *ngIf="errorMessage">
          <i class="bi bi-exclamation-triangle me-2"></i>{{ errorMessage }}
          <button type="button" class="btn-close" (click)="errorMessage = ''" aria-label="Close"></button>
        </div>

        <div class="row">
          <!-- Colonne gauche: Formulaire -->
          <div class="col-lg-5 mb-4">
            <!-- Info sur les cotisations -->
            <div class="card border-0 shadow-sm mb-4 bg-primary bg-opacity-10">
              <div class="card-body">
                <div class="d-flex align-items-start">
                  <div class="bg-primary rounded-circle p-2 me-3">
                    <i class="bi bi-info-circle text-white"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold mb-1">Cotisation mensuelle</h6>
                    <p class="mb-0 small text-muted">Montant fixe de <strong class="text-primary">{{ montants.cotisation | number:'1.0-0' }} FCFA</strong> par mois. Vous pouvez payer plusieurs mois d'avance.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Formulaire de déclaration -->
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-white py-3 border-0">
                <h5 class="card-title mb-0">
                  <i class="bi bi-plus-circle text-primary me-2"></i>Déclarer un paiement
                </h5>
              </div>
              <div class="card-body">
                <form (ngSubmit)="declarer()" #form="ngForm">
                  <div class="mb-3">
                    <label for="moisDebut" class="form-label fw-semibold">Mois de début <span class="text-danger">*</span></label>
                    <input
                      type="month"
                      id="moisDebut"
                      class="form-control"
                      [(ngModel)]="formData.moisDebut"
                      name="moisDebut"
                      (ngModelChange)="verifierMois()"
                      required>
                    <div class="small text-muted mt-1" *ngIf="moisDejaDeclares.size > 0 && !conflit">
                      Les mois déjà déclarés ou payés ne peuvent pas être redéclarés : le premier mois libre est proposé.
                    </div>
                  </div>

                  <div class="mb-3">
                    <label for="nombreMois" class="form-label fw-semibold">Nombre de mois <span class="text-danger">*</span></label>
                    <select
                      id="nombreMois"
                      class="form-select"
                      [(ngModel)]="formData.nombreMois"
                      name="nombreMois"
                      (change)="calculerMontant(); verifierMois()"
                      required>
                      <option *ngFor="let n of [1,2,3,4,5,6,7,8,9,10,11,12]" [value]="n">
                        {{ n }} mois ({{ n * montants.cotisation | number:'1.0-0' }} FCFA)
                      </option>
                    </select>
                  </div>

                  <div class="alert alert-warning py-2 small" *ngIf="conflit">
                    <i class="bi bi-exclamation-triangle me-1"></i>{{ conflit }}
                  </div>

                  <!-- Montant total -->
                  <div class="bg-success bg-opacity-10 rounded-3 p-3 mb-3 text-center">
                    <small class="text-muted d-block">Montant total</small>
                    <span class="fs-3 fw-bold text-success">{{ montantTotal | number:'1.0-0' }} FCFA</span>
                  </div>

                  <div class="mb-3">
                    <label for="modePaiement" class="form-label fw-semibold">Mode de paiement <span class="text-danger">*</span></label>
                    <select
                      id="modePaiement"
                      class="form-select"
                      [(ngModel)]="formData.modePaiement"
                      name="modePaiement"
                      required>
                      <option [value]="'MOBILE_MONEY'">
                        Mobile Money
                      </option>
                      <option [value]="'ESPECES'">
                        Espèces
                      </option>
                    </select>
                  </div>

                  <div class="mb-3">
                    <label for="reference" class="form-label fw-semibold">Référence de transaction</label>
                    <input
                      type="text"
                      id="reference"
                      class="form-control"
                      [(ngModel)]="formData.reference"
                      name="reference"
                      placeholder="Ex: TXN123456789">
                    <small class="text-muted">Numéro fourni par l'opérateur mobile</small>
                  </div>

                  <div class="mb-4">
                    <label for="remarque" class="form-label fw-semibold">Remarque</label>
                    <textarea
                      id="remarque"
                      class="form-control"
                      [(ngModel)]="formData.remarque"
                      name="remarque"
                      rows="2"
                      placeholder="Informations complémentaires..."></textarea>
                  </div>

                  <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-primary btn-lg" [disabled]="!form.valid || loading || !!conflit">
                      <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                      <i class="bi bi-send me-2" *ngIf="!loading"></i>
                      Soumettre ma déclaration
                    </button>
                    <button type="button" class="btn btn-light" (click)="resetForm()">
                      Réinitialiser
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <!-- Colonne droite: Historique -->
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-white py-3 border-0">
                <div class="d-flex justify-content-between align-items-center">
                  <h5 class="card-title mb-0">
                    <i class="bi bi-clock-history text-primary me-2"></i>Historique
                  </h5>
                  <span class="badge bg-primary rounded-pill">{{ cotisations.length }} paiement(s)</span>
                </div>
              </div>
              <div class="card-body p-0">
                <div *ngIf="loadingList" class="text-center py-5">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Chargement...</span>
                  </div>
                  <p class="text-muted mt-2 mb-0">Chargement de vos cotisations...</p>
                </div>

                <!-- Liste vide -->
                <div *ngIf="!loadingList && cotisations.length === 0" class="text-center py-5">
                  <div class="text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                    <p class="mb-1">Aucune cotisation déclarée</p>
                    <small>Utilisez le formulaire pour déclarer votre premier paiement</small>
                  </div>
                </div>

                <!-- Liste des cotisations -->
                <div *ngIf="!loadingList && cotisations.length > 0">
                  <div class="cotisation-item" *ngFor="let cotisation of cotisations">
                    <div class="d-flex justify-content-between align-items-start p-3 border-bottom">
                      <div class="d-flex align-items-start">
                        <div class="icon-circle me-3"
                             [class.bg-warning]="cotisation.statut === 'EN_ATTENTE'"
                             [class.bg-opacity-10]="true"
                             [class.bg-success]="cotisation.statut === 'PAYE'"
                             [class.bg-danger]="cotisation.statut === 'EN_RETARD'"
                             [class.bg-info]="cotisation.statut === 'PARTIEL'">
                          <i class="bi"
                             [class.bi-hourglass-split]="cotisation.statut === 'EN_ATTENTE'"
                             [class.text-warning]="cotisation.statut === 'EN_ATTENTE'"
                             [class.bi-check-circle]="cotisation.statut === 'PAYE'"
                             [class.text-success]="cotisation.statut === 'PAYE'"
                             [class.bi-exclamation-circle]="cotisation.statut === 'EN_RETARD'"
                             [class.text-danger]="cotisation.statut === 'EN_RETARD'"
                             [class.bi-pie-chart]="cotisation.statut === 'PARTIEL'"
                             [class.text-info]="cotisation.statut === 'PARTIEL'"></i>
                        </div>
                        <div>
                          <div class="fw-semibold">{{ formatPeriodes(cotisation.periodes) }}</div>
                          <div class="small text-muted">
                            <span class="me-2"><i class="bi bi-calendar3 me-1"></i>{{ cotisation.datePaiement | date:'dd/MM/yyyy' }}</span>
                            <span><i class="bi bi-credit-card me-1"></i>{{ formatModePaiement(cotisation.modePaiement) }}</span>
                          </div>
                          <div class="small text-muted" *ngIf="cotisation.reference">
                            <i class="bi bi-hash me-1"></i>Réf: {{ cotisation.reference }}
                          </div>
                        </div>
                      </div>
                      <div class="text-end">
                        <div class="fw-bold text-success">{{ cotisation.montant | number:'1.0-0' }} FCFA</div>
                        <span class="badge rounded-pill"
                              [class.bg-warning]="cotisation.statut === 'EN_ATTENTE'"
                              [class.text-dark]="cotisation.statut === 'EN_ATTENTE'"
                              [class.bg-success]="cotisation.statut === 'PAYE'"
                              [class.bg-danger]="cotisation.statut === 'EN_RETARD'"
                              [class.bg-info]="cotisation.statut === 'PARTIEL'">
                          {{ getStatutLabel(cotisation.statut) }}
                        </span>
                        <button *ngIf="cotisation.statut === 'PAYE' && cotisation.operationId" type="button"
                                class="btn btn-sm btn-outline-success ms-2"
                                (click)="recus.ouvrirOperation(cotisation.operationId)" title="Télécharger le reçu">
                          <i class="bi bi-file-earmark-pdf"></i> Reçu
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .icon-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cotisation-item:hover {
      background-color: rgba(0,0,0,0.02);
    }
    .cotisation-item:last-child .border-bottom {
      border-bottom: none !important;
    }
  `]
})
export class CotisationMembreComponent implements OnInit {
  private cotisationService = inject(CotisationService);
  montants = inject(MontantsService);
  recus = inject(RecuService);
  private authService = inject(AuthService);

  cotisations: Cotisation[] = [];
  loading = false;
  loadingList = false;
  successMessage = '';
  errorMessage = '';

  formData: DeclarerCotisationInput = {
    membreId: 0,
    moisDebut: this.getCurrentMonth(),
    nombreMois: 1,
    modePaiement: ModePaiement.MOBILE_MONEY,
    reference: '',
    remarque: ''
  };

  montantTotal = 1000;
  /** Mois (AAAA-MM) déjà déclarés, en attente ou payés : on ne peut pas les déclarer deux fois. */
  moisDejaDeclares = new Set<string>();
  conflit = '';

  private moisSuivant(m: string, n = 1): string {
    const [a, mo] = m.split('-').map(Number);
    const d = new Date(a, mo - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private libelleMois(m: string): string {
    const [a, mo] = m.split('-').map(Number);
    return new Date(a, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  /** Premier mois, à partir du mois courant, qui n'est pas encore déclaré. */
  private premierMoisLibre(): string {
    let m = this.getCurrentMonth();
    for (let i = 0; i < 60 && this.moisDejaDeclares.has(m); i++) m = this.moisSuivant(m);
    return m;
  }

  verifierMois(): void {
    this.conflit = '';
    const debut = this.normalizeMoisDebut(this.formData.moisDebut);
    const n = Number(this.formData.nombreMois) || 1;
    const pris: string[] = [];
    for (let i = 0; i < n; i++) {
      const m = this.moisSuivant(debut, i);
      if (this.moisDejaDeclares.has(m)) pris.push(this.libelleMois(m));
    }
    if (pris.length) {
      this.conflit = pris.length === 1
        ? `Le mois de ${pris[0]} est déjà déclaré ou payé. Choisissez un autre mois de début.`
        : `Ces mois sont déjà déclarés ou payés : ${pris.join(', ')}. Choisissez un autre mois de début.`;
    }
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user?.id) {
      this.formData.membreId = user.id;
      this.loadMesCotisations();
    }
  }

  getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  calculerMontant(): void {
    this.montantTotal = this.formData.nombreMois * this.montants.cotisation;
  }

  loadMesCotisations(): void {
    this.loadingList = true;
    this.cotisationService.getMesCotisations(this.formData.membreId).subscribe({
      next: (cotisations) => {
        this.cotisations = cotisations;
        this.moisDejaDeclares = new Set(
          cotisations.filter(c => c.statut !== StatutCotisation.REJETE)
            .flatMap(c => (c.periodes || c.periode || '').split(',').map(p => p.trim()).filter(Boolean)));
        this.formData.moisDebut = this.premierMoisLibre();
        this.verifierMois();
        this.loadingList = false;
      },
      error: (err) => {
        console.error('Erreur chargement cotisations:', err);
        this.errorMessage = 'Erreur lors du chargement de vos cotisations';
        this.loadingList = false;
      }
    });
  }

  declarer(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const moisDebut = this.normalizeMoisDebut(this.formData.moisDebut);

    const payload = {
      ...this.formData,
      moisDebut: moisDebut
    };

    this.cotisationService.declarer(payload).subscribe({
      next: () => {
        this.successMessage = `Cotisation de ${this.montantTotal} FCFA déclarée avec succès ! En attente de validation par le trésorier.`;
        this.resetForm();
        this.loadMesCotisations();
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur déclaration cotisation:', err);
        this.errorMessage = err.error?.message || err.error?.error || 'Erreur lors de la déclaration de la cotisation';
        this.loading = false;
      }
    });
  }

  normalizeMoisDebut(moisDebut: string): string {
    if (!moisDebut) {
      return this.getCurrentMonth();
    }

    if (/^\d{4}-\d{2}$/.test(moisDebut)) {
      return moisDebut;
    }

    try {
      const date = new Date(moisDebut);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
      }
    } catch (e) {
      console.error('Erreur parsing date:', e);
    }

    return this.getCurrentMonth();
  }

  resetForm(): void {
    this.formData = {
      membreId: this.formData.membreId,
      moisDebut: this.premierMoisLibre(),
      nombreMois: 1,
      modePaiement: ModePaiement.MOBILE_MONEY,
      reference: '',
      remarque: ''
    };
    this.montantTotal = 1000;
    this.verifierMois();
  }

  formatPeriodes(periodes: string): string {
    if (!periodes) return '-';
    const periodesArray = periodes.split(',').map(p => this.formatMois(p.trim()));
    if (periodesArray.length <= 2) {
      return periodesArray.join(', ');
    }
    return `${periodesArray[0]} - ${periodesArray[periodesArray.length - 1]}`;
  }

  formatMois(periode: string): string {
    if (!periode) return periode;
    const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const parts = periode.split('-');
    if (parts.length === 2) {
      const moisIndex = parseInt(parts[1], 10) - 1;
      return `${mois[moisIndex]} ${parts[0]}`;
    }
    return periode;
  }

  formatModePaiement(mode?: string): string {
    const modes: Record<string, string> = {
      'MOBILE_MONEY': 'Mobile Money',
      'ESPECES': 'Espèces'
    };
    return mode ? (modes[mode] || mode) : '-';
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'EN_ATTENTE': 'En attente',
      'PAYE': 'Validé',
      'PARTIEL': 'Partiel',
      'EN_RETARD': 'En retard'
    };
    return labels[statut] || statut;
  }
}
