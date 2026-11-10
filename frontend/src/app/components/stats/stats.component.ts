import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { StatsService, TreasuryStats, MembershipStats, LabelValue } from '../../services/stats.service';
import { ChartBoxComponent } from './chart-box.component';

type Onglet = 'tresorerie' | 'membres' | 'activites';

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const C = {
  teal: '#3d9fa8', orange: '#e89a3c', green: '#4caf7d', red: '#d9534f',
  grey: '#9aa5b1', blue: '#5b7fd1', purple: '#8e6bbf', yellow: '#f2c14e', navy: '#2f3e5c'
};
const COULEURS_ORIGINES = [C.teal, C.green, C.orange, C.blue, C.purple];
const COULEURS_DESTINATIONS = [C.orange, C.purple, C.grey, C.blue];
const COULEURS_CATEGORIES = [C.teal, C.orange, C.purple, C.green, C.blue, C.yellow, C.red, C.grey];

/**
 * Tableaux de bord : trésorerie (trésorier, commissaire, administrateur), membres/cotisations et activités
 * . Tous les chiffres sont calculés par le serveur ; cet écran ne fait que les présenter.
 */
@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChartBoxComponent],
  styles: [`
    .kpi { border: 0; border-left: 4px solid var(--kpi, #3d9fa8); box-shadow: 0 1px 4px rgba(0,0,0,.08); height: 100%; }
    .kpi .kpi-label { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: #6c757d; }
    .kpi .kpi-value { font-size: 1.55rem; font-weight: 700; line-height: 1.2; white-space: nowrap; }
    .kpi .kpi-sub { font-size: .8rem; color: #6c757d; }
    .kpi .kpi-icon { font-size: 1.9rem; opacity: .85; color: var(--kpi, #3d9fa8); }
    .chart-card { border: 0; box-shadow: 0 1px 4px rgba(0,0,0,.08); height: 100%; }
    .chart-card .card-header { background: transparent; border-bottom: 1px solid #eef1f4; padding: .8rem 1rem; }
    .chart-card .card-title { font-size: 1rem; font-weight: 600; margin: 0; float: none; display: block; }
    .chart-card .hint { font-size: .8rem; color: #6c757d; display: block; margin-top: 2px; }
    .vide { text-align: center; color: #8a94a6; padding: 3rem 1rem; }
    .vide i { font-size: 2.2rem; display: block; margin-bottom: .5rem; opacity: .6; }
    .nav-pills .nav-link { color: #495057; font-weight: 600; }
    .nav-pills .nav-link.active { background: #3d9fa8; color: #fff; }
    .nowrap { white-space: nowrap; }
    .barre { height: 8px; border-radius: 4px; background: #eef1f4; overflow: hidden; }
    .barre > span { display: block; height: 100%; background: var(--kpi, #3d9fa8); }
  `],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row align-items-center">
          <div class="col-md-6">
            <h3 class="mb-0"><i class="bi bi-pie-chart me-2"></i>Tableaux de bord</h3>
            <small class="text-muted">Situation de la mutuelle, calculée en direct à partir des opérations enregistrées.</small>
          </div>
          <div class="col-md-6">
            <div class="d-flex justify-content-md-end align-items-center gap-2 mt-2 mt-md-0">
              <label class="text-muted small mb-0" for="annee">Exercice</label>
              <select id="annee" class="form-select form-select-sm w-auto" [(ngModel)]="annee" (change)="charger()">
                <option *ngFor="let y of annees" [ngValue]="y">{{ y }}</option>
              </select>
              <button class="btn btn-sm btn-outline-primary" (click)="charger()" [disabled]="chargement">
                <span *ngIf="chargement" class="spinner-border spinner-border-sm me-1"></span>
                <i *ngIf="!chargement" class="bi bi-arrow-clockwise me-1"></i>Actualiser
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">

        <ul class="nav nav-pills mb-3 gap-1">
          <li class="nav-item" *ngIf="peutVoirTresorerie">
            <a class="nav-link" href="javascript:void(0)" [class.active]="onglet === 'tresorerie'" (click)="choisir('tresorerie')">
              <i class="bi bi-cash-coin me-1"></i>Trésorerie
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="javascript:void(0)" [class.active]="onglet === 'membres'" (click)="choisir('membres')">
              <i class="bi bi-people me-1"></i>Membres et cotisations
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="javascript:void(0)" [class.active]="onglet === 'activites'" (click)="choisir('activites')">
              <i class="bi bi-calendar-event me-1"></i>Activités
            </a>
          </li>
        </ul>

        <div *ngIf="erreur" class="alert alert-danger d-flex justify-content-between align-items-center">
          <span><i class="bi bi-exclamation-triangle me-2"></i>{{ erreur }}</span>
          <button class="btn btn-sm btn-outline-danger" (click)="charger()">Réessayer</button>
        </div>

        <div *ngIf="chargement && !tresorerie && !membres" class="text-center py-5">
          <div class="spinner-border text-primary"></div>
          <p class="mt-3 text-muted">Chargement des statistiques…</p>
        </div>

        <!-- ============================ TRÉSORERIE ============================ -->
        <ng-container *ngIf="onglet === 'tresorerie' && tresorerie as t">

          <div *ngIf="t.depensesEnAttente > 0" class="alert alert-warning d-flex align-items-center">
            <i class="bi bi-hourglass-split fs-4 me-3"></i>
            <div>
              <strong>{{ t.depensesEnAttente }} dépense(s) de {{ fmt(t.montantDepensesEnAttente) }} FCFA</strong>
              attendent la confirmation du président. Elles ne sont pas encore comptées dans la caisse.
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #3d9fa8"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">{{ ExerciceCourant ? 'Solde de la caisse' : 'Caisse au 31 décembre ' + annee }}</div>
                  <div class="kpi-value">{{ fmt(ExerciceCourant ? t.soldeCaisse : t.soldeFinAnnee) }} <small class="fs-6">FCFA</small></div>
                  <div class="kpi-sub">Au 1er janvier : {{ fmt(t.soldeDebutAnnee) }} FCFA</div>
                </div>
                <i class="bi bi-wallet2 kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #4caf7d"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Entrées {{ annee }}</div>
                  <div class="kpi-value">{{ fmt(t.totalEntrees) }} <small class="fs-6">FCFA</small></div>
                  <div class="kpi-sub">dont cotisations : {{ fmt(t.totalCotisations) }}</div>
                </div>
                <i class="bi bi-box-arrow-in-down kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #e89a3c"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Sorties {{ annee }}</div>
                  <div class="kpi-value">{{ fmt(t.totalSorties) }} <small class="fs-6">FCFA</small></div>
                  <div class="kpi-sub">dont prêts versés : {{ fmt(t.totalPretsVerses) }}</div>
                </div>
                <i class="bi bi-box-arrow-up kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" [style.--kpi]="t.totalEntrees - t.totalSorties >= 0 ? '#4caf7d' : '#d9534f'"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Résultat {{ annee }}</div>
                  <div class="kpi-value" [class.text-success]="t.totalEntrees - t.totalSorties >= 0" [class.text-danger]="t.totalEntrees - t.totalSorties < 0">
                    {{ t.totalEntrees - t.totalSorties > 0 ? '+' : '' }}{{ fmt(t.totalEntrees - t.totalSorties) }} <small class="fs-6">FCFA</small>
                  </div>
                  <div class="kpi-sub">entrées moins sorties de l'exercice</div>
                </div>
                <i class="bi bi-graph-up-arrow kpi-icon"></i>
              </div></div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #5b7fd1"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Prêts en cours</div>
                  <div class="kpi-value">{{ t.pretsEnCours }}</div>
                  <div class="kpi-sub">{{ fmt(t.encoursPrets) }} FCFA restent à rembourser</div>
                </div>
                <i class="bi bi-credit-card kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" [style.--kpi]="t.echeancesEnRetard > 0 ? '#d9534f' : '#4caf7d'"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Échéances en retard</div>
                  <div class="kpi-value" [class.text-danger]="t.echeancesEnRetard > 0">{{ t.echeancesEnRetard }}</div>
                  <div class="kpi-sub">{{ t.echeancesEnRetard > 0 ? fmt(t.montantEnRetard) + ' FCFA à recouvrer' : 'Aucun retard de remboursement' }}</div>
                </div>
                <i class="bi bi-alarm kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #8e6bbf"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Échéances à venir</div>
                  <div class="kpi-value">{{ t.echeancesProchains30Jours }}</div>
                  <div class="kpi-sub">dans les 30 prochains jours · aujourd'hui : {{ t.echeancesAujourdHui }}</div>
                </div>
                <i class="bi bi-calendar-check kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #f2c14e"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Demandes de prêt à traiter</div>
                  <div class="kpi-value">{{ t.pretsEnAttente }}</div>
                  <div class="kpi-sub"><a routerLink="/prets">Ouvrir les prêts</a></div>
                </div>
                <i class="bi bi-inbox kpi-icon"></i>
              </div></div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-xl-8">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Entrées, sorties et solde de la caisse - {{ annee }}</h5>
                  <div class="hint">Les barres montrent ce qui entre et sort chaque mois ; la courbe, l'argent disponible en fin de mois.</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['flux']; else videFlux" [options]="graphiques['flux']"></app-chart-box>
                  <ng-template #videFlux><div class="vide"><i class="bi bi-bar-chart"></i>Aucune opération enregistrée en {{ annee }}.</div></ng-template>
                </div>
              </div>
            </div>
            <div class="col-xl-4">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">D'où vient l'argent</h5>
                  <div class="hint">Entrées de {{ annee }} par origine</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['origines']; else videOrigines" [options]="graphiques['origines']"></app-chart-box>
                  <ng-template #videOrigines><div class="vide"><i class="bi bi-pie-chart"></i>Aucune entrée en {{ annee }}.</div></ng-template>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-xl-4">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Où va l'argent</h5>
                  <div class="hint">Sorties de {{ annee }} par destination</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['destinations']; else videDest" [options]="graphiques['destinations']"></app-chart-box>
                  <ng-template #videDest><div class="vide"><i class="bi bi-pie-chart"></i>Aucune sortie en {{ annee }}.</div></ng-template>
                </div>
              </div>
            </div>
            <div class="col-xl-4">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Cotisations réglées, mois par mois</h5>
                  <div class="hint">Part des membres actifs à jour pour chaque mois de {{ annee }}</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['tauxCotisation']; else videTaux" [options]="graphiques['tauxCotisation']"></app-chart-box>
                  <ng-template #videTaux><div class="vide"><i class="bi bi-bar-chart"></i>Aucun membre actif à suivre pour {{ annee }}.</div></ng-template>
                </div>
              </div>
            </div>
            <div class="col-xl-4">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Prêts par situation</h5>
                  <div class="hint">Tous les prêts de la mutuelle</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['prets']; else videPrets" [options]="graphiques['prets']"></app-chart-box>
                  <ng-template #videPrets><div class="vide"><i class="bi bi-credit-card"></i>Aucun prêt enregistré.</div></ng-template>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title"><i class="bi bi-exclamation-octagon me-1 text-danger"></i>Retards de remboursement</h5>
                  <div class="hint">Les 10 membres qui doivent le plus d'échéances dépassées</div>
                </div>
                <div class="card-body p-0">
                  <div *ngIf="t.retardsRemboursement.length === 0" class="vide"><i class="bi bi-emoji-smile"></i>Aucun retard de remboursement.</div>
                  <div class="table-responsive" *ngIf="t.retardsRemboursement.length > 0">
                    <table class="table table-sm table-hover align-middle mb-0">
                      <thead class="table-light"><tr>
                        <th>Membre</th><th class="text-end">Échéances</th><th class="text-end">Reste dû</th><th class="text-end">Retard max.</th>
                      </tr></thead>
                      <tbody>
                        <tr *ngFor="let r of t.retardsRemboursement">
                          <td>{{ r.nom }}</td>
                          <td class="text-end">{{ r.echeances }}</td>
                          <td class="text-end nowrap fw-semibold text-danger">{{ fmt(r.montant) }} FCFA</td>
                          <td class="text-end nowrap">{{ r.joursMax }} jour{{ r.joursMax > 1 ? 's' : '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title"><i class="bi bi-trophy me-1 text-warning"></i>Plus grosses sorties de {{ annee }}</h5>
                  <div class="hint">Prêts versés et dépenses, du plus élevé au plus faible</div>
                </div>
                <div class="card-body p-0">
                  <div *ngIf="t.topDepenses.length === 0" class="vide"><i class="bi bi-inbox"></i>Aucune sortie en {{ annee }}.</div>
                  <div class="table-responsive" *ngIf="t.topDepenses.length > 0">
                    <table class="table table-sm table-hover align-middle mb-0">
                      <thead class="table-light"><tr><th>Opération</th><th class="text-end">Montant</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let d of t.topDepenses">
                          <td>{{ d.label }}</td>
                          <td class="text-end nowrap fw-semibold">{{ fmt(d.amount) }} FCFA</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ============================ MEMBRES ET COTISATIONS ============================ -->
        <ng-container *ngIf="onglet === 'membres' && membres as m">
          <div class="row g-3 mb-3">
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #3d9fa8"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Membres actifs</div>
                  <div class="kpi-value">{{ m.membresActifs }}</div>
                  <div class="kpi-sub">sur {{ m.totalMembres }} comptes</div>
                </div>
                <i class="bi bi-people kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #f2c14e"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">En attente de validation</div>
                  <div class="kpi-value">{{ m.membresEnAttente }}</div>
                  <div class="kpi-sub">{{ m.visiteurs }} visiteur(s) · {{ m.membresInactifs }} inactif(s)</div>
                </div>
                <i class="bi bi-hourglass-split kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" [style.--kpi]="couleurTaux(m.tauxAJour)"><div class="card-body">
                <div class="d-flex justify-content-between">
                  <div>
                    <div class="kpi-label">Membres à jour de leurs cotisations</div>
                    <div class="kpi-value">{{ m.tauxAJour === null ? '-' : (m.tauxAJour | number:'1.0-1':'fr') + ' %' }}</div>
                    <div class="kpi-sub">{{ m.membresAJour }} à jour · {{ m.membresEnRetard }} en retard</div>
                  </div>
                  <i class="bi bi-check2-circle kpi-icon"></i>
                </div>
                <div class="barre mt-2"><span [style.width.%]="m.tauxAJour || 0"></span></div>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" [style.--kpi]="m.montantImpaye > 0 ? '#d9534f' : '#4caf7d'"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Cotisations impayées</div>
                  <div class="kpi-value" [class.text-danger]="m.montantImpaye > 0">{{ fmt(m.montantImpaye) }} <small class="fs-6">FCFA</small></div>
                  <div class="kpi-sub">
                    <span *ngIf="m.avertissementsPossibles > 0">{{ m.avertissementsPossibles }} membre(s) avec un an d'arriérés ou plus</span>
                    <span *ngIf="m.avertissementsPossibles === 0">Aucun membre à un an d'arriérés</span>
                  </div>
                </div>
                <i class="bi bi-cash-stack kpi-icon"></i>
              </div></div>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Retards de cotisation</h5>
                  <div class="hint">Membres actifs selon le nombre de mois impayés</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['retards']; else videRetards" [options]="graphiques['retards']"></app-chart-box>
                  <ng-template #videRetards><div class="vide"><i class="bi bi-bar-chart"></i>Aucun membre actif à suivre.</div></ng-template>
                </div>
              </div>
            </div>
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Nouveaux comptes et nouveaux adhérents - {{ annee }}</h5>
                  <div class="hint">Comptes créés et adhésions validées, mois par mois</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['inscriptions']; else videInsc" [options]="graphiques['inscriptions']"></app-chart-box>
                  <ng-template #videInsc><div class="vide"><i class="bi bi-bar-chart"></i>Aucune inscription en {{ annee }}.</div></ng-template>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">État des comptes</h5>
                  <div class="hint">Où en sont les {{ m.totalMembres }} comptes de la mutuelle</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['etats']; else videEtats" [options]="graphiques['etats']"></app-chart-box>
                  <ng-template #videEtats><div class="vide"><i class="bi bi-pie-chart"></i>Aucun compte.</div></ng-template>
                </div>
              </div>
            </div>
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Rôles des membres actifs</h5>
                  <div class="hint">Répartition des responsabilités</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['roles']; else videRoles" [options]="graphiques['roles']"></app-chart-box>
                  <ng-template #videRoles><div class="vide"><i class="bi bi-pie-chart"></i>Aucun membre actif.</div></ng-template>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ============================ ACTIVITÉS ============================ -->
        <ng-container *ngIf="onglet === 'activites' && membres as m">
          <div class="row g-3 mb-3">
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #f2c14e"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Demandes en attente</div>
                  <div class="kpi-value">{{ m.manifestationsEnAttente }}</div>
                  <div class="kpi-sub"><a routerLink="/manifestations">Ouvrir les manifestations</a></div>
                </div>
                <i class="bi bi-inbox kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #5b7fd1"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Planifiées</div>
                  <div class="kpi-value">{{ m.manifestationsPlanifiees }}</div>
                  <div class="kpi-sub">à venir ou en cours en {{ annee }}</div>
                </div>
                <i class="bi bi-calendar-event kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #4caf7d"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Réalisées</div>
                  <div class="kpi-value">{{ m.manifestationsRealisees }}</div>
                  <div class="kpi-sub">{{ m.manifestationsAnnulees }} annulée(s)</div>
                </div>
                <i class="bi bi-check2-all kpi-icon"></i>
              </div></div>
            </div>
            <div class="col-6 col-xl-3">
              <div class="card kpi" style="--kpi: #e89a3c"><div class="card-body d-flex justify-content-between">
                <div>
                  <div class="kpi-label">Versé pour les activités</div>
                  <div class="kpi-value">{{ fmt(m.depensesActivites) }} <small class="fs-6">FCFA</small></div>
                  <div class="kpi-sub">prestations et dépenses de {{ annee }}</div>
                </div>
                <i class="bi bi-gift kpi-icon"></i>
              </div></div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Activités par catégorie - {{ annee }}</h5>
                  <div class="hint">Manifestations planifiées et réalisées</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['categories']; else videCat" [options]="graphiques['categories']"></app-chart-box>
                  <ng-template #videCat><div class="vide"><i class="bi bi-pie-chart"></i>Aucune activité planifiée ou réalisée en {{ annee }}.</div></ng-template>
                </div>
              </div>
            </div>
            <div class="col-xl-6">
              <div class="card chart-card">
                <div class="card-header">
                  <h5 class="card-title">Coût des activités par catégorie - {{ annee }}</h5>
                  <div class="hint">Sommes réellement versées</div>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiques['coutCategories']; else videCout" [options]="graphiques['coutCategories']"></app-chart-box>
                  <ng-template #videCout><div class="vide"><i class="bi bi-bar-chart"></i>Aucune somme versée pour des activités en {{ annee }}.</div></ng-template>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <p class="text-muted small text-end" *ngIf="misAJour">Mis à jour à {{ misAJour }}</p>
      </div>
    </div>
  `
})
export class StatsComponent implements OnInit {
  private statsService = inject(StatsService);
  private auth = inject(AuthService);

  readonly anneeCourante = new Date().getFullYear();
  annees = Array.from({ length: 5 }, (_, i) => this.anneeCourante - i);
  annee = this.anneeCourante;

  peutVoirTresorerie = false;
  onglet: Onglet = 'membres';

  tresorerie: TreasuryStats | null = null;
  membres: MembershipStats | null = null;
  graphiques: Record<string, any> = {};

  chargement = false;
  erreur = '';
  misAJour = '';

  get ExerciceCourant(): boolean {
    return this.annee === this.anneeCourante;
  }

  ngOnInit(): void {
    this.peutVoirTresorerie = this.auth.hasAnyRole(['TRESORIER', 'COMMISSAIRE', 'ADMIN']);
    this.onglet = this.peutVoirTresorerie ? 'tresorerie' : 'membres';
    this.charger();
  }

  choisir(o: Onglet): void {
    this.onglet = o;
  }

  charger(): void {
    this.chargement = true;
    this.erreur = '';
    const erreurs: string[] = [];
    const garder = (nom: string) => catchError((err: any) => {
      erreurs.push(err?.error?.message || `Impossible de charger les statistiques (${nom}).`);
      return of(null);
    });

    forkJoin({
      t: this.peutVoirTresorerie ? this.statsService.getTreasuryStats(this.annee).pipe(garder('trésorerie')) : of(null),
      m: this.statsService.getMembershipStats(this.annee).pipe(garder('membres'))
    }).subscribe(({ t, m }: { t: any; m: any }) => {
      this.chargement = false;
      if (erreurs.length) this.erreur = erreurs[0];
      if (t) this.tresorerie = t;
      if (m) this.membres = m;
      this.construireGraphiques();
      this.misAJour = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    });
  }

  // ------------------------------------------------------------------
  // Mise en forme
  // ------------------------------------------------------------------

  fmt(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v || 0)).replace(/ /g, ' ');
  }

  private abrege(v: number): string {
    const a = Math.abs(v);
    if (a >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    if (a >= 1_000) return Math.round(v / 1_000).toLocaleString('fr-FR') + ' k';
    return String(Math.round(v));
  }

  couleurTaux(taux: number | null): string {
    if (taux === null) return C.grey;
    if (taux >= 80) return C.green;
    if (taux >= 50) return C.orange;
    return C.red;
  }

  // ------------------------------------------------------------------
  // Graphiques
  // ------------------------------------------------------------------

  private base(type: string, height: number): any {
    return { type, height, fontFamily: 'inherit', toolbar: { show: false }, animations: { speed: 500 } };
  }

  private somme(l: LabelValue[] | undefined): number {
    return (l || []).reduce((s, x) => s + x.value, 0);
  }

  private beigne(items: LabelValue[] | undefined, couleurs: string[], libelleTotal: string, argent: boolean): any | null {
    const l = (items || []).filter(x => x.value > 0);
    if (l.length === 0) return null;
    const total = this.somme(l);
    const format = (v: number) => argent ? this.fmt(v) + ' FCFA' : String(v);
    return {
      series: l.map(x => x.value),
      labels: l.map(x => x.label),
      chart: this.base('donut', 310),
      colors: couleurs.slice(0, l.length),
      stroke: { width: 2 },
      dataLabels: { enabled: l.length > 1, formatter: (v: number) => Math.round(v) + ' %', dropShadow: { enabled: false } },
      legend: { position: 'bottom', fontSize: '13px' },
      tooltip: { y: { formatter: format } },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              value: { fontSize: '20px', fontWeight: 700, formatter: (v: string) => argent ? this.abrege(+v) : v },
              total: { show: true, showAlways: true, label: libelleTotal, formatter: () => argent ? this.abrege(total) : String(total) }
            }
          }
        }
      }
    };
  }

  private barresHorizontales(items: LabelValue[] | undefined, couleurs: string[], unite: string, argent: boolean): any | null {
    const l = (items || []).filter(x => x.value > 0);
    if (l.length === 0) return null;
    return {
      series: [{ name: unite, data: l.map(x => x.value) }],
      chart: this.base('bar', Math.max(240, 60 + l.length * 48)),
      colors: couleurs,
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4, barHeight: '62%' } },
      dataLabels: { enabled: true, formatter: (v: number) => argent ? this.abrege(v) : String(v), style: { fontSize: '12px' } },
      legend: { show: false },
      xaxis: { categories: l.map(x => x.label), labels: { formatter: (v: string) => argent ? this.abrege(+v) : v } },
      grid: { borderColor: '#eef1f4', strokeDashArray: 4 },
      tooltip: { y: { formatter: (v: number) => argent ? this.fmt(v) + ' FCFA' : v + ' ' + unite } }
    };
  }

  private construireGraphiques(): void {
    const g: Record<string, any> = {};
    const t = this.tresorerie;
    const m = this.membres;

    if (t) {
      const aDesFlux = t.monthlyCashflow.some(x => x.entrees > 0 || x.sorties > 0);
      if (aDesFlux) {
        g['flux'] = {
          series: [
            { name: 'Entrées', type: 'column', data: t.monthlyCashflow.map(x => x.entrees) },
            { name: 'Sorties', type: 'column', data: t.monthlyCashflow.map(x => x.sorties) },
            { name: 'Solde de la caisse', type: 'line', data: t.monthlyCashflow.map(x => x.solde ?? null) }
          ],
          chart: this.base('line', 360),
          colors: [C.teal, C.orange, C.navy],
          stroke: { width: [0, 0, 3], curve: 'smooth' },
          plotOptions: { bar: { columnWidth: '58%', borderRadius: 3 } },
          markers: { size: [0, 0, 4] },
          dataLabels: { enabled: false },
          xaxis: { categories: MOIS },
          yaxis: { labels: { formatter: (v: number) => this.abrege(v) } },
          legend: { position: 'top', horizontalAlign: 'right' },
          grid: { borderColor: '#eef1f4', strokeDashArray: 4 },
          tooltip: { shared: true, intersect: false, y: { formatter: (v: number | null) => v === null || v === undefined ? '-' : this.fmt(v) + ' FCFA' } }
        };
      }
      g['origines'] = this.beigne(t.entreesParOrigine, COULEURS_ORIGINES, 'Entrées', true);
      g['destinations'] = this.beigne(t.sortiesParDestination, COULEURS_DESTINATIONS, 'Sorties', true);

      const suivis = t.cotisationsParMois.filter(x => x.taux !== null);
      if (suivis.length > 0) {
        const cm = t.cotisationsParMois;
        g['tauxCotisation'] = {
          series: [{ name: 'Membres à jour', data: cm.map(x => x.taux) }],
          chart: this.base('bar', 310),
          colors: [C.teal],
          plotOptions: { bar: { columnWidth: '62%', borderRadius: 3 } },
          dataLabels: { enabled: true, formatter: (v: number | null) => v === null ? '' : Math.round(v) + '', style: { fontSize: '11px' } },
          xaxis: { categories: MOIS },
          yaxis: { min: 0, max: 100, tickAmount: 5, labels: { formatter: (v: number) => Math.round(v) + ' %' } },
          grid: { borderColor: '#eef1f4', strokeDashArray: 4 },
          tooltip: {
            y: {
              formatter: (v: number | null, o: any) => {
                const c = cm[o?.dataPointIndex ?? 0];
                return v === null || !c ? '-' : `${v} % (${c.payes} sur ${c.attendus} membres)`;
              }
            }
          }
        };
      }
      g['prets'] = this.barresHorizontales(t.pretsParStatut, [C.yellow, C.purple, C.blue, C.green, C.grey], 'prêt(s)', false);
    }

    if (m) {
      const retards = m.repartitionRetards || [];
      if (this.somme(retards) > 0) {
        g['retards'] = {
          series: [{ name: 'Membres', data: retards.map(x => x.value) }],
          chart: this.base('bar', 310),
          colors: [C.green, C.yellow, C.orange, C.red],
          plotOptions: { bar: { distributed: true, columnWidth: '55%', borderRadius: 4 } },
          dataLabels: { enabled: true, style: { fontSize: '13px' } },
          legend: { show: false },
          xaxis: { categories: retards.map(x => x.label) },
          yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => String(Math.round(v)) } },
          grid: { borderColor: '#eef1f4', strokeDashArray: 4 },
          tooltip: { y: { formatter: (v: number) => v + ' membre(s)' } }
        };
      }
      const insc = m.inscriptionsParMois.map(x => x.count);
      const adh = m.adhesionsParMois.map(x => x.count);
      if (insc.some(v => v > 0) || adh.some(v => v > 0)) {
        g['inscriptions'] = {
          series: [{ name: 'Comptes créés', data: insc }, { name: 'Adhésions validées', data: adh }],
          chart: this.base('bar', 310),
          colors: [C.teal, C.orange],
          plotOptions: { bar: { columnWidth: '62%', borderRadius: 3 } },
          dataLabels: { enabled: false },
          xaxis: { categories: MOIS },
          yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => String(Math.round(v)) } },
          legend: { position: 'top', horizontalAlign: 'right' },
          grid: { borderColor: '#eef1f4', strokeDashArray: 4 },
          tooltip: { shared: true, intersect: false }
        };
      }
      g['etats'] = this.beigne(m.repartitionEtat, [C.green, C.blue, C.yellow, C.grey, C.red], 'Comptes', false);
      g['roles'] = this.beigne(m.repartitionRoles, COULEURS_CATEGORIES, 'Actifs', false);
      g['categories'] = this.beigne(m.repartitionManifestations, COULEURS_CATEGORIES, 'Activités', false);
      g['coutCategories'] = this.barresHorizontales(m.depensesParCategorie, COULEURS_CATEGORIES, 'FCFA', true);
    }

    // On retire les graphiques vides pour que l'écran affiche le message « aucune donnée »
    this.graphiques = Object.fromEntries(Object.entries(g).filter(([, v]) => v));
  }
}
