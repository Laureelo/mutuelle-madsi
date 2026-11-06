import { Component, OnInit, OnDestroy, AfterViewInit, inject, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LoginResponse } from '../../models/auth.model';
import { StatsService, TreasuryStats, MembershipStats } from '../../services/stats.service';
import { ChartBoxComponent } from '../stats/chart-box.component';
import { MembreService } from '../../services/membre.service';
import { CotisationService } from '../../services/cotisation.service';
import { ManifestationService } from '../../services/manifestation.service';
import { Cotisation, StatutCotisation } from '../../models/cotisation.model';
import { Manifestation } from '../../models/manifestation.model';
import { MontantsService } from '../../services/montants.service';
import { ConfirmationService, ConfirmationsEnAttente } from '../../services/confirmation.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ChartBoxComponent],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col-sm-6">
            <h3 class="mb-0">Tableau de Bord</h3>
          </div>
          <div class="col-sm-6">
            <div class="d-flex justify-content-end align-items-center gap-2">
              <button class="btn btn-sm btn-outline-primary" (click)="loadStats()" title="Rafraîchir les statistiques">
                <i class="bi bi-arrow-clockwise"></i> Actualiser
              </button>
              <ol class="breadcrumb mb-0">
                <li class="breadcrumb-item"><a href="#">Accueil</a></li>
                <li class="breadcrumb-item active" aria-current="page">Dashboard</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <!-- Alerte VISITEUR -->
        <div class="alert alert-warning alert-dismissible mb-4" *ngIf="currentMembre && currentMembre.etatCompte === 'VISITEUR'">
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          <h5 class="alert-heading">
            <i class="bi bi-exclamation-triangle me-2"></i>Adhésion requise
          </h5>
          <p class="mb-2">
            Bienvenue ! Votre compte a le statut <strong>VISITEUR</strong>. Pour devenir membre actif de MADSI
            et accéder à toutes les fonctionnalités, vous devez payer vos frais d'adhésion de <strong>{{ montants.adhesion | number:'1.0-0' }} FCFA</strong>.
          </p>
          <hr>
          <a [routerLink]="['/adhesion']" class="btn btn-warning">
            <i class="bi bi-cash-coin me-2"></i>Déclarer mon paiement d'adhésion
          </a>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
          </div>
          <p class="mt-3">Chargement des statistiques...</p>
        </div>

        <!-- ========== CARTES RESUME (Admin/Trésorier uniquement) ========== -->
        <div *ngIf="situation && situation.nombreMoisImpayes > 0" class="alert alert-warning d-flex align-items-center mb-4">
          <i class="bi bi-exclamation-triangle-fill fs-3 me-3"></i>
          <div class="flex-grow-1">
            <strong>Cotisations impayées : {{ situation.nombreMoisImpayes }} mois, soit {{ situation.montantImpaye | number:'1.0-0' }} FCFA</strong><br>
            <span class="small">
              Mois concernés : {{ situation.moisImpayes[0] }}<span *ngIf="situation.moisImpayes.length > 1"> à {{ situation.moisImpayes[situation.moisImpayes.length - 1] }}</span>.
              <span *ngIf="situation.cotisationsAJourExigees">Tant qu'ils ne sont pas régularisés, vous ne pouvez pas obtenir de prêt ni de prestation.</span>
            </span>
          </div>
          <a routerLink="/cotisations/mes-cotisations" class="btn btn-sm btn-warning">Déclarer un paiement</a>
        </div>

        <div *ngIf="confirmations && confirmations.total > 0" class="alert alert-warning d-flex align-items-center mb-4">
          <i class="bi bi-person-check-fill fs-3 me-3"></i>
          <div class="flex-grow-1">
            <strong>Votre confirmation est requise</strong><br>
            <span *ngIf="confirmations.prets > 0">{{ confirmations.prets }} prêt(s)</span>
            <span *ngIf="confirmations.prets > 0 && confirmations.depenses > 0"> et </span>
            <span *ngIf="confirmations.depenses > 0">{{ confirmations.depenses }} dépense(s)</span>
            de plus de {{ confirmations.seuil | number:'1.0-0' }} FCFA attendent la confirmation du président.
          </div>
          <a routerLink="/prets" class="btn btn-sm btn-warning me-2">Prêts</a>
          <a routerLink="/operations" class="btn btn-sm btn-warning">Opérations</a>
        </div>

        <!-- ========== VUE D'ENSEMBLE : trésorier, commissaire, administrateur ========== -->
        <div *ngIf="isTresorier && treasuryStats as t" class="mb-4">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="mb-0"><i class="bi bi-speedometer2 me-2"></i>Vue d'ensemble {{ anneeCourante }}</h5>
            <a routerLink="/stats" class="btn btn-sm btn-outline-primary">Tableaux de bord détaillés <i class="bi bi-arrow-right ms-1"></i></a>
          </div>

          <div class="row">
            <div class="col-12 col-sm-6 col-xl-3">
              <div class="info-box">
                <span class="info-box-icon text-bg-primary shadow-sm"><i class="bi bi-wallet2"></i></span>
                <div class="info-box-content">
                  <span class="info-box-text">Solde de la caisse</span>
                  <span class="info-box-number">{{ formatMoney(t.soldeCaisse) }} <small>FCFA</small></span>
                  <small class="text-muted">argent disponible aujourd'hui</small>
                </div>
              </div>
            </div>
            <div class="col-12 col-sm-6 col-xl-3">
              <div class="info-box">
                <span class="info-box-icon text-bg-success shadow-sm"><i class="bi bi-arrow-down-circle"></i></span>
                <div class="info-box-content">
                  <span class="info-box-text">Entrées {{ anneeCourante }}</span>
                  <span class="info-box-number">{{ formatMoney(t.totalEntrees) }} <small>FCFA</small></span>
                  <small class="text-muted">dont {{ formatMoney(t.totalCotisations) }} de cotisations</small>
                </div>
              </div>
            </div>
            <div class="col-12 col-sm-6 col-xl-3">
              <div class="info-box">
                <span class="info-box-icon text-bg-warning shadow-sm"><i class="bi bi-arrow-up-circle"></i></span>
                <div class="info-box-content">
                  <span class="info-box-text">Sorties {{ anneeCourante }}</span>
                  <span class="info-box-number">{{ formatMoney(t.totalSorties) }} <small>FCFA</small></span>
                  <small class="text-muted">dont {{ formatMoney(t.totalPretsVerses) }} de prêts versés</small>
                </div>
              </div>
            </div>
            <div class="col-12 col-sm-6 col-xl-3">
              <div class="info-box">
                <span class="info-box-icon text-bg-info shadow-sm"><i class="bi bi-credit-card"></i></span>
                <div class="info-box-content">
                  <span class="info-box-text">Prêts en cours</span>
                  <span class="info-box-number">{{ t.pretsEnCours }}</span>
                  <small class="text-muted">{{ formatMoney(t.encoursPrets) }} FCFA à rembourser</small>
                </div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col-lg-8 mb-3">
              <div class="card h-100">
                <div class="card-header" style="background: linear-gradient(135deg, #3d9fa8 0%, #2d7a80 100%); border-bottom: 3px solid #e89a3c;">
                  <h5 class="card-title mb-0 text-white"><i class="bi bi-graph-up me-2"></i>Entrées, sorties et caisse — {{ anneeCourante }}</h5>
                </div>
                <div class="card-body">
                  <app-chart-box *ngIf="graphiqueFlux; else pasDeFlux" [options]="graphiqueFlux"></app-chart-box>
                  <ng-template #pasDeFlux>
                    <div class="text-center text-muted py-5"><i class="bi bi-bar-chart display-6"></i><p class="mt-2 mb-0">Aucune opération enregistrée en {{ anneeCourante }}.</p></div>
                  </ng-template>
                </div>
              </div>
            </div>
            <div class="col-lg-4 mb-3">
              <div class="card h-100">
                <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-bell me-2"></i>Points d'attention</h5></div>
                <div class="list-group list-group-flush">
                  <a *ngIf="t.depensesEnAttente > 0" routerLink="/operations" class="list-group-item list-group-item-action list-group-item-warning">
                    <i class="bi bi-hourglass-split me-2"></i><strong>{{ t.depensesEnAttente }} dépense(s)</strong> à confirmer par le président ({{ formatMoney(t.montantDepensesEnAttente) }} FCFA)
                  </a>
                  <a *ngIf="t.echeancesEnRetard > 0" routerLink="/prets" class="list-group-item list-group-item-action list-group-item-danger">
                    <i class="bi bi-alarm me-2"></i><strong>{{ t.echeancesEnRetard }} échéance(s) en retard</strong> : {{ formatMoney(t.montantEnRetard) }} FCFA à recouvrer
                  </a>
                  <a *ngIf="t.pretsEnAttente > 0" routerLink="/prets" class="list-group-item list-group-item-action">
                    <i class="bi bi-inbox me-2"></i><strong>{{ t.pretsEnAttente }} demande(s) de prêt</strong> à traiter
                  </a>
                  <a *ngIf="membershipStats && membershipStats.membresEnRetard > 0" routerLink="/stats" class="list-group-item list-group-item-action">
                    <i class="bi bi-cash-stack me-2"></i><strong>{{ membershipStats.membresEnRetard }} membre(s)</strong> en retard de cotisation ({{ formatMoney(membershipStats.montantImpaye) }} FCFA)
                  </a>
                  <a *ngIf="membershipStats && membershipStats.avertissementsPossibles > 0" routerLink="/stats" class="list-group-item list-group-item-action list-group-item-warning">
                    <i class="bi bi-exclamation-triangle me-2"></i><strong>{{ membershipStats.avertissementsPossibles }} membre(s)</strong> avec un an d'arriérés ou plus
                  </a>
                  <a *ngIf="membershipStats && membershipStats.membresEnAttente > 0" routerLink="/membres" class="list-group-item list-group-item-action">
                    <i class="bi bi-person-check me-2"></i><strong>{{ membershipStats.membresEnAttente }} compte(s)</strong> en attente de validation
                  </a>
                  <div *ngIf="!aDesPointsAttention(t)" class="list-group-item text-success">
                    <i class="bi bi-check-circle me-2"></i>Rien à signaler : tout est à jour.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== SECTION MEMBRE STANDARD ========== -->
        <div *ngIf="!loading && currentUser?.id" class="row">
          <!-- Manifestations Card -->
          <div class="col-lg-6 col-md-6 mb-4">
            <div class="card">
              <div class="card-header bg-primary text-white">
                <h5 class="card-title mb-0">
                  <i class="bi bi-calendar-event me-2"></i>Mes Manifestations
                </h5>
              </div>
              <div class="card-body">
                <div *ngIf="manifestations.length === 0" class="text-center py-3">
                  <i class="bi bi-inbox display-6 text-muted"></i>
                  <p class="text-muted mt-2">Aucune manifestation</p>
                </div>
                <div *ngIf="manifestations.length > 0">
                  <h3 class="mb-3">{{ manifestations.length }}</h3>
                  <div class="list-group">
                    <div *ngFor="let manif of manifestations.slice(0, 5)" class="list-group-item">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{{ manif.libelle }}</strong>
                          <br>
                          <small class="text-muted">{{ formatDate(manif.date) }}</small>
                        </div>
                        <span class="badge"
                              [class.bg-warning]="manif.statut === 'PLANIFIEE'"
                              [class.bg-success]="manif.statut === 'REALISEE'"
                              [class.bg-danger]="manif.statut === 'ANNULEE'">
                          {{ getStatutLabel(manif.statut) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-3">
                    <a [routerLink]="['/manifestations']" class="btn btn-sm btn-outline-primary">
                      Voir toutes <i class="bi bi-arrow-right ms-1"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cotisations Card -->
          <div class="col-lg-6 col-md-6 mb-4">
            <div class="card">
              <div class="card-header"
                   [class.bg-success]="estAJour"
                   [class.bg-warning]="!estAJour">
                <h5 class="card-title mb-0 text-white">
                  <i class="bi bi-cash-stack me-2"></i>Mes Cotisations
                </h5>
              </div>
              <div class="card-body">
                <div *ngIf="cotisations.length === 0" class="text-center py-3">
                  <i class="bi bi-inbox display-6 text-muted"></i>
                  <p class="text-muted mt-2">Aucune cotisation</p>
                </div>
                <div *ngIf="cotisations.length > 0">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="mb-0">{{ estAJour ? cotisations.length : moisNonPayes.length }}</h3>
                    <span class="badge"
                          [class.bg-success]="estAJour"
                          [class.bg-warning]="!estAJour"
                          style="font-size: 1rem; padding: 0.5rem 1rem;">
                      <i class="bi"
                         [class.bi-check-circle-fill]="estAJour"
                         [class.bi-exclamation-triangle-fill]="!estAJour"
                         me-1></i>
                      {{ estAJour ? 'À jour' : 'En retard' }}
                    </span>
                  </div>

                  <div *ngIf="!estAJour && moisNonPayes.length > 0" class="alert alert-warning">
                    <strong>Mois non payés :</strong>
                    <ul class="mb-0 mt-2">
                      <li *ngFor="let mois of moisNonPayes">{{ mois }}</li>
                    </ul>
                  </div>

                  <div class="list-group">
                    <div *ngFor="let cot of cotisations.slice(0, 5)" class="list-group-item">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{{ libellePeriode(cot) }}</strong>
                          <br>
                          <small class="text-muted">{{ formatMoney(cot.montant) }} FCFA</small>
                        </div>
                        <span class="badge"
                              [class.bg-success]="cot.statut === StatutCotisation.PAYE"
                              [class.bg-warning]="cot.statut === StatutCotisation.EN_ATTENTE"
                              [class.bg-info]="cot.statut === StatutCotisation.PARTIEL"
                              [class.bg-danger]="cot.statut === StatutCotisation.EN_RETARD">
                          {{ getStatutCotisationLabel(cot.statut) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-3">
                    <a [routerLink]="['/cotisations']" class="btn btn-sm btn-outline-primary">
                      Voir toutes <i class="bi bi-arrow-right ms-1"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Alert -->
        <div *ngIf="error" class="alert alert-danger alert-dismissible fade show" role="alert">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          {{ error }}
          <button type="button" class="btn-close" (click)="error = ''" aria-label="Close"></button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .info-box {
      box-shadow: 0 0 1px rgba(0,0,0,.125), 0 1px 3px rgba(0,0,0,.2);
      border-radius: .25rem;
      background-color: #fff;
      display: flex;
      margin-bottom: 1rem;
      min-height: 80px;
      padding: .5rem;
      position: relative;
      width: 100%;
    }

    .info-box-icon {
      border-radius: .25rem;
      align-items: center;
      display: flex;
      font-size: 1.875rem;
      justify-content: center;
      text-align: center;
      width: 70px;
    }

    .info-box-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      line-height: 1.8;
      flex: 1;
      padding: 0 10px;
      overflow: hidden;
    }

    .info-box-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .info-box-number {
      display: block;
      margin-top: .25rem;
      font-weight: 700;
    }

    .progress-group {
      margin-bottom: 0.5rem;
    }

    .progress-sm {
      height: 10px;
    }

    .card-header {
      border-bottom: none;
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {

  private authService = inject(AuthService);

  confirmationService = inject(ConfirmationService);

  montants = inject(MontantsService);
  private router = inject(Router);
  private statsService = inject(StatsService);
  private membreService = inject(MembreService);
  private cotisationService = inject(CotisationService);
  private manifestationService = inject(ManifestationService);

  currentUser: LoginResponse | null = null;
  membershipStats: MembershipStats | null = null;
  currentMembre: any = null;
  loading = true;
  error = '';
  isBrowser = false;

  // Données du membre
  cotisations: Cotisation[] = [];
  manifestations: Manifestation[] = [];
  moisNonPayes: string[] = [];
  estAJour = true;
  anneeCourante = new Date().getFullYear();

  // Données trésorier
  treasuryStats: TreasuryStats | null = null;

  // Graphique entrées / sorties / caisse
  graphiqueFlux: any = null;

  private refreshSubscription?: Subscription;
  private isLoadingStats = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadCurrentMembre();
        // IMPORTANT: Charger les stats quand l'utilisateur est défini
        this.loadStats();
      }
    });
  }

  ngOnInit(): void {
    // S'abonner aux notifications de rafraîchissement
    this.refreshSubscription = this.statsService.refreshStats$.subscribe(() => {
      this.loadStats();
    });
  }

  ngAfterViewInit(): void {
    // Le graphique sera initialisé après le chargement des données
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  get isTresorier(): boolean {
    return this.currentUser?.roles?.some(role =>
      role === 'TRESORIER' || role === 'COMMISSAIRE' || role === 'ADMIN'
    ) || false;
  }

  /** Y a-t-il au moins un point à signaler dans la liste « Points d'attention » ? */
  aDesPointsAttention(t: TreasuryStats): boolean {
    const m = this.membershipStats;
    return t.depensesEnAttente > 0 || t.echeancesEnRetard > 0 || t.pretsEnAttente > 0
      || !!m && (m.membresEnRetard > 0 || m.avertissementsPossibles > 0 || m.membresEnAttente > 0);
  }

  loadCurrentMembre(): void {
    if (this.currentUser?.id) {
      this.membreService.getById(this.currentUser.id).subscribe({
        next: (membre) => {
          this.currentMembre = membre;
        },
        error: (err) => {
          console.error('Erreur chargement membre:', err);
        }
      });
    }
  }

  loadStats(): void {
    // Empêcher les appels simultanés
    if (this.isLoadingStats) {
      return;
    }

    // Un visiteur n'a accès ni aux cotisations ni aux manifestations : rien à charger
    if (this.currentUser?.roles?.includes('VISITEUR')) {
      this.isLoadingStats = false;
      this.loading = false;
      return;
    }

    this.isLoadingStats = true;
    this.loading = true;
    this.error = '';

    if (!this.currentUser?.id) {
      this.loading = false;
      this.isLoadingStats = false;
      return;
    }

    const membreId = this.currentUser.id;

    // Le membre connaît sa situation : mois de cotisation impayés et montant dû
    if (membreId) {
      this.membreService.getSituation(membreId).subscribe({
        next: (s) => {
          this.situation = s;
          this.moisNonPayes = s?.moisImpayes || [];
          this.estAJour = !!s?.aJour;
        },
        error: () => { this.situation = null; }
      });
    }

    // Le président (administrateur) est informé de ce qui attend sa confirmation
    if (this.currentUser?.roles?.includes('ADMIN')) {
      this.confirmationService.enAttente().subscribe({
        next: (c) => { this.confirmations = c; },
        error: () => { this.confirmations = null; }
      });
    }

    // Chiffres de la mutuelle : trésorerie (trésorier, commissaire, admin) et membres
    if (this.isTresorier) {
      this.statsService.getTreasuryStats(this.anneeCourante).subscribe({
        next: (stats) => {
          this.treasuryStats = stats;
          this.construireGraphique(stats);
        },
        error: (err) => console.error('Erreur chargement stats trésorerie:', err?.error?.message || err)
      });
    }
    if (this.isTresorier) {
      this.statsService.getMembershipStats(this.anneeCourante).subscribe({
        next: (stats) => { this.membershipStats = stats; },
        error: (err) => console.error('Erreur chargement stats membres:', err?.error?.message || err)
      });
    }

    // Charger les manifestations du membre
    this.manifestationService.getAll({
      q: '',
      page: 0,
      size: 10
    }).subscribe({
      next: (response) => {
        // Filtrer les manifestations du membre connecté
        this.manifestations = response.content.filter(m => m.membreId === membreId);

        // Charger les cotisations du membre
        this.cotisationService.getByMembre(membreId).subscribe({
          next: (cotisations) => {
            this.cotisations = cotisations;

            // Les mois impayés viennent de la situation du membre (même calcul que partout dans l'application)
            this.loading = false;
            this.isLoadingStats = false;
          },
          error: (err) => {
            console.error('Erreur chargement cotisations:', err);
            this.loading = false;
            this.isLoadingStats = false;
          }
        });
      },
      error: (err) => {
        console.error('Erreur chargement manifestations:', err);
        this.loading = false;
        this.isLoadingStats = false;
      }
    });
  }

  private construireGraphique(stats: TreasuryStats): void {
    const flux = stats.monthlyCashflow || [];
    if (!this.isBrowser || !flux.some(m => m.entrees > 0 || m.sorties > 0)) {
      this.graphiqueFlux = null;
      return;
    }
    const abrege = (v: number) => Math.abs(v) >= 1_000_000
      ? (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M'
      : Math.abs(v) >= 1_000 ? Math.round(v / 1_000).toLocaleString('fr-FR') + ' k' : String(Math.round(v));
    this.graphiqueFlux = {
      series: [
        { name: 'Entrées', type: 'column', data: flux.map(m => m.entrees) },
        { name: 'Sorties', type: 'column', data: flux.map(m => m.sorties) },
        { name: 'Solde de la caisse', type: 'line', data: flux.map(m => m.solde ?? null) }
      ],
      chart: { type: 'line', height: 320, fontFamily: 'inherit', toolbar: { show: false } },
      colors: ['#3d9fa8', '#e89a3c', '#2f3e5c'],
      stroke: { width: [0, 0, 3], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: '58%', borderRadius: 3 } },
      markers: { size: [0, 0, 4] },
      dataLabels: { enabled: false },
      xaxis: { categories: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'] },
      yaxis: { labels: { formatter: abrege } },
      legend: { position: 'top', horizontalAlign: 'right' },
      grid: { borderColor: '#eef1f4', strokeDashArray: 4 },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number | null) => v === null || v === undefined ? '—' : this.formatMoney(v) + ' FCFA' } }
    };
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(amount || 0)).replace(/\u202f/g, '\u00a0');
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'PLANIFIEE': 'Planifiée',
      'REALISEE': 'Réalisée',
      'ANNULEE': 'Annulée'
    };
    return labels[statut] || statut;
  }

  /** « janv. 2025 », ou « janv. 2025 → juin 2025 » quand le paiement couvre plusieurs mois. */
  libellePeriode(cot: any): string {
    const liste = String(cot.periodes || cot.periode || '').split(',').map((p: string) => p.trim()).filter(Boolean);
    if (!liste.length) return 'Cotisation';
    const nom = (p: string) => {
      const [a, m] = p.split('-').map(Number);
      return new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    };
    return liste.length === 1 ? nom(liste[0]) : nom(liste[0]) + ' → ' + nom(liste[liste.length - 1]);
  }

  getStatutCotisationLabel(statut: StatutCotisation): string {
    const labels: Record<StatutCotisation, string> = {
      [StatutCotisation.PAYE]: 'Payée',
      [StatutCotisation.EN_ATTENTE]: 'En attente',
      [StatutCotisation.PARTIEL]: 'Partielle',
      [StatutCotisation.EN_RETARD]: 'En retard',
      [StatutCotisation.REJETE]: 'Rejetée'
    };
    return labels[statut] || statut;
  }

  readonly StatutCotisation = StatutCotisation;

  confirmations: ConfirmationsEnAttente | null = null;
  situation: any = null;

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
