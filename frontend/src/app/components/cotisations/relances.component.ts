import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { lienWhatsApp, moisEnLettres, numeroWhatsApp } from '../../utils/whatsapp';

interface Arriere {
  membreId: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  nombreMois: number;
  moisImpayes: string[];
  montantDu: number;
  avertissementPossible: boolean;
}

const MESSAGE_PAR_DEFAUT =
  'Bonjour {prenom}, ici le trésorier de la mutuelle MADSI. Il vous reste {nombre} mois de cotisation à régler, ' +
  'soit {montant} FCFA (de {debut} à {fin}). Vous pouvez déclarer votre paiement dans l\'application. Merci !';

/**
 * Suivi des cotisations impayées : qui doit combien, avec les boutons « WhatsApp » (envoi manuel : le message est
 * prérempli, la personne chargée du suivi appuie elle-même sur « Envoyer »).
 */
@Component({
  selector: 'app-relances',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  styles: [`
    .kpi { border: 0; border-left: 4px solid var(--kpi, #3d9fa8); box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .kpi .v { font-size: 1.5rem; font-weight: 700; white-space: nowrap; }
    .kpi .l { font-size: .78rem; text-transform: uppercase; color: #6c757d; letter-spacing: .04em; }
    .btn-wa { background: #25d366; color: #fff; border: 0; }
    .btn-wa:hover { background: #1ebe5b; color: #fff; }
    .nowrap { white-space: nowrap; }
  `],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <h3 class="mb-0"><i class="bi bi-megaphone me-2"></i>Relances des cotisations</h3>
        <small class="text-muted">Membres actifs qui ont des mois de cotisation impayés, du plus en retard au moins en retard.</small>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <div *ngIf="erreur" class="alert alert-danger">{{ erreur }}</div>
        <div *ngIf="chargement" class="text-center py-5"><div class="spinner-border text-primary"></div></div>

        <ng-container *ngIf="!chargement && donnees">
          <div class="row g-3 mb-3">
            <div class="col-6 col-lg-3"><div class="card kpi h-100" style="--kpi:#d9534f"><div class="card-body">
              <div class="l">Membres en retard</div><div class="v">{{ donnees.totalMembres }}</div></div></div></div>
            <div class="col-6 col-lg-3"><div class="card kpi h-100" style="--kpi:#e89a3c"><div class="card-body">
              <div class="l">Total impayé</div><div class="v">{{ fmt(donnees.totalMontant) }} <small class="fs-6">FCFA</small></div></div></div></div>
            <div class="col-6 col-lg-3"><div class="card kpi h-100" style="--kpi:#8e6bbf"><div class="card-body">
              <div class="l" title="Un an d'arriérés ou plus : avertissement possible (règlement intérieur, art. 14)">Arriérés d'un an et plus</div><div class="v">{{ nbAvertissements }}</div></div></div></div>
            <div class="col-6 col-lg-3"><div class="card kpi h-100" style="--kpi:#3d9fa8"><div class="card-body">
              <div class="l">Cotisation mensuelle</div><div class="v">{{ fmt(donnees.montantCotisation) }} <small class="fs-6">FCFA</small></div></div></div></div>
          </div>

          <div class="card mb-3">
            <div class="card-body">
              <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
                <div class="d-flex gap-2 flex-wrap">
                  <input type="search" class="form-control form-control-sm" style="width: 230px" placeholder="Rechercher un membre…" [(ngModel)]="recherche" />
                  <div class="form-check form-switch align-self-center mb-0">
                    <input class="form-check-input" type="checkbox" id="seuil" [(ngModel)]="seulementAnnee" />
                    <label class="form-check-label small" for="seuil">Un an ou plus seulement</label>
                  </div>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <a class="btn btn-sm btn-outline-primary" [routerLink]="['/annonces']" [queryParams]="{audience: 'EN_RETARD'}">
                    <i class="bi bi-envelope me-1"></i>Écrire à tous les retardataires
                  </a>
                  <button class="btn btn-sm btn-outline-secondary" (click)="modele = !modele">
                    <i class="bi bi-pencil me-1"></i>Modifier le message WhatsApp
                  </button>
                </div>
              </div>
              <div *ngIf="modele" class="mt-3">
                <textarea class="form-control" rows="3" [(ngModel)]="message" (ngModelChange)="memoriser()"></textarea>
                <small class="text-muted">Les mots entre accolades sont remplacés pour chaque membre :
                  {{ '{prenom}, {nombre}, {montant}, {debut}, {fin}' }}.
                  <a href="javascript:void(0)" (click)="message = defaut; memoriser()">Rétablir le message d'origine</a></small>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-body p-0">
              <div *ngIf="filtres.length === 0" class="text-center text-muted py-5">
                <i class="bi bi-emoji-smile fs-1 d-block mb-2"></i>
                {{ donnees.totalMembres === 0 ? 'Tous les membres actifs sont à jour de leurs cotisations.' : 'Aucun membre ne correspond à la recherche.' }}
              </div>
              <div class="table-responsive" *ngIf="filtres.length > 0">
                <table class="table table-hover align-middle mb-0">
                  <thead class="table-light"><tr>
                    <th>Membre</th><th>Mois impayés</th><th class="text-end">Montant dû</th><th>Contact</th><th class="text-end">Relancer</th>
                  </tr></thead>
                  <tbody>
                    <tr *ngFor="let a of filtres">
                      <td>
                        <strong>{{ a.nom }}</strong>
                        <span *ngIf="a.avertissementPossible" class="badge text-bg-danger ms-1" title="Un an d'arriérés ou plus : avertissement possible (règlement intérieur, art. 14)">1 an+</span>
                      </td>
                      <td>
                        <span class="badge" [class.text-bg-warning]="a.nombreMois < 4" [class.text-bg-danger]="a.nombreMois >= 4">{{ a.nombreMois }} mois</span>
                        <small class="text-muted ms-1" [title]="a.moisImpayes.join(', ')">{{ moisEnLettres(a.moisImpayes[0]) }} → {{ moisEnLettres(a.moisImpayes[a.moisImpayes.length - 1]) }}</small>
                      </td>
                      <td class="text-end nowrap fw-semibold">{{ fmt(a.montantDu) }} FCFA</td>
                      <td class="small">
                        <div *ngIf="a.telephone">{{ a.telephone }}</div>
                        <div *ngIf="!a.telephone" class="text-muted">pas de téléphone</div>
                      </td>
                      <td class="text-end nowrap">
                        <a *ngIf="numero(a)" class="btn btn-sm btn-wa me-1" [href]="lien(a)" target="_blank" rel="noopener" title="Ouvrir WhatsApp avec le message prêt">
                          <i class="bi bi-whatsapp me-1"></i>WhatsApp
                        </a>
                        <button *ngIf="!numero(a)" class="btn btn-sm btn-outline-secondary me-1" disabled title="Numéro absent ou invalide">
                          <i class="bi bi-whatsapp me-1"></i>WhatsApp
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" (click)="copier(a)" title="Copier le message (SMS, autre application…)">
                          <i class="bi bi-clipboard me-1"></i>{{ copie === a.membreId ? 'Copié' : 'Copier' }}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `
})
export class RelancesComponent implements OnInit {
  private http = inject(HttpClient);

  readonly defaut = MESSAGE_PAR_DEFAUT;
  readonly moisEnLettres = moisEnLettres;
  donnees: { membres: Arriere[]; totalMembres: number; totalMontant: number; montantCotisation: number } | null = null;
  chargement = true;
  erreur = '';
  recherche = '';
  seulementAnnee = false;
  modele = false;
  message = MESSAGE_PAR_DEFAUT;
  copie: number | null = null;

  ngOnInit(): void {
    try {
      const m = localStorage.getItem('relance_message');
      if (m) this.message = m;
    } catch { /* le message d'origine reste */ }
    this.http.get<any>(`${environment.apiUrl}/cotisations/arrieres`).subscribe({
      next: (d) => { this.donnees = d; this.chargement = false; },
      error: (err) => { this.erreur = err?.error?.message || 'Impossible de charger la liste.'; this.chargement = false; }
    });
  }

  get filtres(): Arriere[] {
    const q = this.recherche.trim().toLowerCase();
    return (this.donnees?.membres || []).filter(a =>
      (!q || a.nom.toLowerCase().includes(q)) && (!this.seulementAnnee || a.avertissementPossible));
  }

  get nbAvertissements(): number {
    return (this.donnees?.membres || []).filter(a => a.avertissementPossible).length;
  }

  fmt(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v || 0)).replace(/ /g, ' ');
  }

  memoriser(): void {
    try { localStorage.setItem('relance_message', this.message); } catch { /* sans importance */ }
  }

  texte(a: Arriere): string {
    const prenom = a.nom.split(' ')[0] || a.nom;
    return this.message
      .replace(/\{prenom\}/g, prenom)
      .replace(/\{nombre\}/g, String(a.nombreMois))
      .replace(/\{montant\}/g, this.fmt(a.montantDu))
      .replace(/\{debut\}/g, moisEnLettres(a.moisImpayes[0]))
      .replace(/\{fin\}/g, moisEnLettres(a.moisImpayes[a.moisImpayes.length - 1]));
  }

  numero(a: Arriere): string | null {
    return numeroWhatsApp(a.telephone);
  }

  lien(a: Arriere): string | null {
    return lienWhatsApp(a.telephone, this.texte(a));
  }

  copier(a: Arriere): void {
    navigator.clipboard?.writeText(this.texte(a)).then(() => {
      this.copie = a.membreId;
      setTimeout(() => this.copie = null, 2000);
    });
  }
}
