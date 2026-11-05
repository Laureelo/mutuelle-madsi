import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationService } from '../../services/operation.service';
import { RapportService, RapportParams } from '../../services/rapport.service';
import { AuthService } from '../../services/auth.service';

type Modele = 'JOURNAL' | 'COTISATIONS' | 'PRETS' | 'MEMBRES' | 'ACTIVITES' | 'ANNUEL';
type Format = 'PDF' | 'XLSX' | 'CSV';

interface Carte {
  modele: Modele;
  titre: string;
  icone: string;
  couleur: string;
  description: string;
  contenu: string[];
}

const TYPES: Record<Modele, RapportParams['type']> = {
  JOURNAL: 'FINANCIER', COTISATIONS: 'FINANCIER', PRETS: 'FINANCIER',
  MEMBRES: 'STATISTIQUE', ACTIVITES: 'METIER', ANNUEL: 'FIN_DE_MANDAT'
};

/**
 * Rapports de la mutuelle (PDF, Excel, CSV). Tous les rapports portent sur la période choisie ; le rapport annuel
 * porte sur l'année choisie. Les chiffres sont ceux de la caisse : opérations enregistrées uniquement.
 */
@Component({
  selector: 'app-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .kpi { border: 0; border-left: 4px solid var(--kpi, #3d9fa8); box-shadow: 0 1px 4px rgba(0,0,0,.08); height: 100%; }
    .kpi .l { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: #6c757d; }
    .kpi .v { font-size: 1.45rem; font-weight: 700; white-space: nowrap; }
    .kpi .s { font-size: .8rem; color: #6c757d; }
    .rapport { border: 1px solid #e3e8ee; border-top: 4px solid var(--c, #3d9fa8); border-radius: 10px; height: 100%; background: #fff; }
    .rapport h5 { font-size: 1.05rem; font-weight: 700; margin-bottom: .25rem; }
    .rapport ul { padding-left: 1.1rem; margin-bottom: .75rem; font-size: .82rem; color: #55606e; }
    .rapport .ico { font-size: 1.6rem; color: var(--c, #3d9fa8); }
    .rapport.occupe { opacity: .65; pointer-events: none; }
    .btn-fmt { font-size: .8rem; }
  `],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <h3 class="mb-0"><i class="bi bi-file-earmark-bar-graph me-2"></i>Rapports</h3>
        <small class="text-muted">Documents à imprimer ou à présenter (assemblée générale, commissaire aux comptes) : choisissez la période, puis le rapport.</small>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <div *ngIf="successMessage" class="alert alert-success alert-dismissible">
          <i class="bi bi-check-circle me-2"></i>{{ successMessage }}
          <button type="button" class="btn-close" (click)="successMessage = ''"></button>
        </div>
        <div *ngIf="errorMessage" class="alert alert-danger alert-dismissible">
          <i class="bi bi-exclamation-triangle me-2"></i>{{ errorMessage }}
          <button type="button" class="btn-close" (click)="errorMessage = ''"></button>
        </div>
        <div *ngIf="!peutGenerer" class="alert alert-info">
          <i class="bi bi-lock me-2"></i>La génération des rapports est réservée au trésorier, au commissaire aux comptes et à l'administrateur.
        </div>

        <!-- Période -->
        <div class="card mb-3">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-sm-6 col-lg-2">
                <label class="form-label mb-1">Du</label>
                <input type="date" class="form-control" [(ngModel)]="dateDebut" (change)="chargerApercu()" />
              </div>
              <div class="col-sm-6 col-lg-2">
                <label class="form-label mb-1">Au</label>
                <input type="date" class="form-control" [(ngModel)]="dateFin" (change)="chargerApercu()" />
              </div>
              <div class="col-lg-8">
                <div class="d-flex flex-wrap gap-2">
                  <button class="btn btn-sm btn-outline-secondary" (click)="periode('mois')">Ce mois</button>
                  <button class="btn btn-sm btn-outline-secondary" (click)="periode('moisPrecedent')">Mois dernier</button>
                  <button class="btn btn-sm btn-outline-secondary" (click)="periode('trimestre')">Ce trimestre</button>
                  <button class="btn btn-sm btn-outline-secondary" (click)="periode('annee')">Cette année</button>
                  <button class="btn btn-sm btn-outline-secondary" (click)="periode('anneePrecedente')">Année dernière</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Aperçu de la période -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-lg-3"><div class="card kpi" style="--kpi:#3d9fa8"><div class="card-body">
            <div class="l">Caisse aujourd'hui</div><div class="v">{{ fmt(soldeAujourdhui) }} <small class="fs-6">FCFA</small></div>
          </div></div></div>
          <div class="col-6 col-lg-3"><div class="card kpi" style="--kpi:#4caf7d"><div class="card-body">
            <div class="l">Entrées de la période</div><div class="v text-success">{{ apercu ? '+' + fmt(apercu.entrees) : '…' }} <small class="fs-6">FCFA</small></div>
          </div></div></div>
          <div class="col-6 col-lg-3"><div class="card kpi" style="--kpi:#e89a3c"><div class="card-body">
            <div class="l">Sorties de la période</div><div class="v" style="color:#c97a1f">{{ apercu ? '-' + fmt(apercu.sorties) : '…' }} <small class="fs-6">FCFA</small></div>
          </div></div></div>
          <div class="col-6 col-lg-3"><div class="card kpi" [style.--kpi]="apercu && apercu.entrees - apercu.sorties < 0 ? '#d9534f' : '#4caf7d'"><div class="card-body">
            <div class="l">Résultat de la période</div>
            <div class="v" [class.text-danger]="apercu && apercu.entrees - apercu.sorties < 0">
              {{ apercu ? (apercu.entrees - apercu.sorties > 0 ? '+' : '') + fmt(apercu.entrees - apercu.sorties) : '…' }} <small class="fs-6">FCFA</small>
            </div>
            <div class="s" *ngIf="apercuNote">{{ apercuNote }}</div>
          </div></div></div>
        </div>

        <!-- Les rapports -->
        <div class="row g-3 mb-4">
          <div class="col-xl-4 col-md-6" *ngFor="let c of cartes">
            <div class="rapport p-3" [class.occupe]="occupe" [style.--c]="c.couleur">
              <div class="d-flex align-items-start gap-3">
                <i class="bi ico" [ngClass]="c.icone"></i>
                <div>
                  <h5>{{ c.titre }}</h5>
                  <div class="text-muted small mb-2">{{ c.description }}</div>
                </div>
              </div>
              <ul><li *ngFor="let l of c.contenu">{{ l }}</li></ul>
              <div *ngIf="c.modele === 'ANNUEL'" class="d-flex align-items-center gap-2 mb-2">
                <label class="small text-muted mb-0">Exercice</label>
                <select class="form-select form-select-sm w-auto" [(ngModel)]="anneeBilan">
                  <option *ngFor="let a of annees" [ngValue]="a">{{ a }}</option>
                </select>
              </div>
              <div *ngIf="peutGenerer" class="d-flex gap-2">
                <button class="btn btn-sm btn-primary" (click)="generer(c.modele, 'PDF')" [disabled]="occupe">
                  <span *ngIf="encours === c.modele + 'PDF'" class="spinner-border spinner-border-sm me-1"></span>
                  <i *ngIf="encours !== c.modele + 'PDF'" class="bi bi-file-earmark-pdf me-1"></i>PDF
                </button>
                <button class="btn btn-sm btn-outline-success btn-fmt" (click)="generer(c.modele, 'XLSX')" [disabled]="occupe">
                  <span *ngIf="encours === c.modele + 'XLSX'" class="spinner-border spinner-border-sm me-1"></span>
                  <i *ngIf="encours !== c.modele + 'XLSX'" class="bi bi-file-earmark-excel me-1"></i>Excel
                </button>
                <button class="btn btn-sm btn-outline-secondary btn-fmt" (click)="generer(c.modele, 'CSV')" [disabled]="occupe">
                  <span *ngIf="encours === c.modele + 'CSV'" class="spinner-border spinner-border-sm me-1"></span>
                  <i *ngIf="encours !== c.modele + 'CSV'" class="bi bi-filetype-csv me-1"></i>CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        <p class="text-muted small">
          Seules les opérations <strong>enregistrées</strong> sont comptées : une opération annulée, ou une dépense qui attend encore la confirmation du président,
          n'a pas bougé la caisse. Chaque rapport indique en bas ce qui n'a pas été compté.
        </p>
      </div>
    </div>
  `
})
export class RapportsComponent implements OnInit {
  private operationService = inject(OperationService);
  private rapportService = inject(RapportService);
  private authService = inject(AuthService);

  readonly annees = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  anneeBilan = new Date().getFullYear();

  readonly cartes: Carte[] = [
    {
      modele: 'JOURNAL', titre: 'Rapport financier', icone: 'bi-cash-stack', couleur: '#3d9fa8',
      description: 'Le journal de caisse de la période',
      contenu: ['Caisse au début et à la fin de la période', 'Entrées par origine, sorties par destination', 'Détail de chaque opération']
    },
    {
      modele: 'COTISATIONS', titre: 'Rapport des cotisations', icone: 'bi-wallet2', couleur: '#4caf7d',
      description: 'Ce qui a été encaissé, et qui est en retard',
      contenu: ['Encaissements mois par mois', 'Liste des cotisations encaissées', 'Membres en retard et montants dus']
    },
    {
      modele: 'PRETS', titre: 'Rapport des prêts', icone: 'bi-bank', couleur: '#e89a3c',
      description: 'Prêts versés et remboursements',
      contenu: ['Prêts versés et remboursements reçus', 'Prêts en cours et reste à rembourser', 'Échéances en retard']
    },
    {
      modele: 'MEMBRES', titre: 'Rapport des membres', icone: 'bi-people', couleur: '#5b7fd1',
      description: 'Effectif et adhésions',
      contenu: ['Membres par état et par rôle', 'Nouveaux adhérents de la période', 'Liste des membres actifs et mois impayés']
    },
    {
      modele: 'ACTIVITES', titre: 'Rapport des activités', icone: 'bi-calendar-event', couleur: '#8e6bbf',
      description: 'Prestations et manifestations',
      contenu: ['Activités par situation et par catégorie', 'Sommes prévues et réellement versées', 'Détail de chaque activité']
    },
    {
      modele: 'ANNUEL', titre: 'Rapport annuel', icone: 'bi-journal-text', couleur: '#d9534f',
      description: 'Le bilan de l\'exercice (assemblée générale, fin de mandat)',
      contenu: ['Caisse du 1er janvier au 31 décembre, mois par mois', 'Cotisations, prêts, membres, activités', 'Une synthèse de deux pages']
    }
  ];

  dateDebut = '';
  dateFin = '';
  soldeAujourdhui = 0;
  apercu: { entrees: number; sorties: number } | null = null;
  apercuNote = '';
  encours = '';
  successMessage = '';
  errorMessage = '';

  get peutGenerer(): boolean {
    return this.authService.hasAnyRole(['TRESORIER', 'COMMISSAIRE', 'ADMIN']);
  }

  get occupe(): boolean {
    return this.encours !== '';
  }

  ngOnInit(): void {
    this.periode('annee');
    this.operationService.getSolde().subscribe({
      next: (r) => this.soldeAujourdhui = r.soldeTotal,
      error: () => this.soldeAujourdhui = 0
    });
  }

  // ------------------------------------------------------------------
  // Période
  // ------------------------------------------------------------------

  private iso(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${j}`;
  }

  periode(p: 'mois' | 'moisPrecedent' | 'trimestre' | 'annee' | 'anneePrecedente'): void {
    const n = new Date();
    const a = n.getFullYear();
    let d: Date, f: Date;
    switch (p) {
      case 'mois': d = new Date(a, n.getMonth(), 1); f = new Date(a, n.getMonth() + 1, 0); break;
      case 'moisPrecedent': d = new Date(a, n.getMonth() - 1, 1); f = new Date(a, n.getMonth(), 0); break;
      case 'trimestre': { const t = Math.floor(n.getMonth() / 3) * 3; d = new Date(a, t, 1); f = new Date(a, t + 3, 0); break; }
      case 'anneePrecedente': d = new Date(a - 1, 0, 1); f = new Date(a - 1, 11, 31); break;
      default: d = new Date(a, 0, 1); f = new Date(a, 11, 31);
    }
    this.dateDebut = this.iso(d);
    this.dateFin = this.iso(f);
    this.chargerApercu();
  }

  /** Entrées et sorties de la période : différence entre les totaux cumulés de la caisse à la fin et à la veille du début. */
  chargerApercu(): void {
    this.apercu = null;
    this.apercuNote = '';
    if (!this.dateDebut || !this.dateFin || this.dateDebut > this.dateFin) return;
    const aujourdhui = this.iso(new Date());
    const fin = this.dateFin > aujourdhui ? aujourdhui : this.dateFin;
    if (this.dateFin > aujourdhui) this.apercuNote = 'Jusqu\'à aujourd\'hui (la fin de période est à venir)';
    const veille = new Date(this.dateDebut + 'T00:00:00');
    veille.setDate(veille.getDate() - 1);
    const veilleIso = this.iso(veille);
    if (this.dateDebut > aujourdhui) { this.apercu = { entrees: 0, sorties: 0 }; return; }
    this.operationService.getSolde(fin).subscribe({
      next: (apres) => {
        this.operationService.getSolde(veilleIso).subscribe({
          next: (avant) => this.apercu = {
            entrees: apres.totalEntrees - avant.totalEntrees,
            sorties: apres.totalSorties - avant.totalSorties
          },
          error: () => this.apercu = null
        });
      },
      error: () => this.apercu = null
    });
  }

  // ------------------------------------------------------------------
  // Génération
  // ------------------------------------------------------------------

  generer(modele: Modele, format: Format): void {
    this.successMessage = '';
    this.errorMessage = '';
    let debut = this.dateDebut;
    let fin = this.dateFin;
    if (modele === 'ANNUEL') {
      debut = `${this.anneeBilan}-01-01`;
      fin = `${this.anneeBilan}-12-31`;
    }
    if (!debut || !fin) {
      this.errorMessage = 'Choisissez une période (date de début et date de fin).';
      return;
    }
    if (debut > fin) {
      this.errorMessage = 'La date de début doit être antérieure à la date de fin.';
      return;
    }
    const params: RapportParams = { periodeDebut: debut, periodeFin: fin, type: TYPES[modele], modele, export: { format } };
    this.encours = modele + format;
    this.rapportService.generer(params).subscribe({
      next: (rapport) => {
        this.rapportService.telecharger(rapport.id).subscribe({
          next: (blob) => {
            this.encours = '';
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rapport-${modele.toLowerCase()}-${debut}_${fin}.${format.toLowerCase()}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.successMessage = 'Rapport généré : le téléchargement a démarré.';
          },
          error: (err) => {
            this.encours = '';
            this.errorMessage = 'Le téléchargement a échoué : ' + (err?.error?.message || err.message);
          }
        });
      },
      error: (err) => {
        this.encours = '';
        this.errorMessage = 'Impossible de générer le rapport : ' + (err?.error?.message || err.message);
      }
    });
  }

  fmt(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v || 0)).replace(/ /g, ' ');
  }
}
