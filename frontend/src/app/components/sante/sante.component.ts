import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Santé du système (administrateur) : l'application, la base de données, le disque et les sauvegardes
 * en un coup d'œil. Lecture seule.
 */
@Component({
  selector: 'app-sante',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .carte { border: 0; box-shadow: 0 1px 4px rgba(0,0,0,.08); height: 100%; border-left: 4px solid var(--c, #4caf7d); }
    .carte .titre { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: #6c757d; }
    .carte .gros { font-size: 1.35rem; font-weight: 700; }
    .carte .ico { font-size: 1.8rem; color: var(--c, #4caf7d); }
    dl { margin: 0; }
    dt { font-weight: 400; color: #6c757d; font-size: .85rem; }
    dd { margin-bottom: .4rem; }
  `],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="row align-items-center">
          <div class="col-md-8">
            <h3 class="mb-0"><i class="bi bi-heart-pulse me-2"></i>Santé du système</h3>
            <small class="text-muted">Réservé à l'administrateur. Vérifie que l'application, la base de données, le disque et les sauvegardes vont bien.</small>
          </div>
          <div class="col-md-4 text-md-end mt-2 mt-md-0">
            <button class="btn btn-sm btn-outline-primary" (click)="charger()" [disabled]="chargement">
              <span *ngIf="chargement" class="spinner-border spinner-border-sm me-1"></span>
              <i *ngIf="!chargement" class="bi bi-arrow-clockwise me-1"></i>Actualiser
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <div *ngIf="erreur" class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>{{ erreur }}</div>
        <div *ngIf="chargement && !e" class="text-center py-5"><div class="spinner-border text-primary"></div></div>

        <ng-container *ngIf="e">
          <div class="alert" [class.alert-success]="toutVaBien" [class.alert-warning]="!toutVaBien">
            <i class="bi me-2" [class.bi-check-circle-fill]="toutVaBien" [class.bi-exclamation-triangle-fill]="!toutVaBien"></i>
            <strong>{{ toutVaBien ? 'Tout va bien.' : 'Un point demande votre attention.' }}</strong>
            <span class="ms-2" *ngIf="!toutVaBien">Voyez les cartes en orange ou en rouge ci-dessous.</span>
          </div>

          <div class="row g-3">
            <div class="col-md-6 col-xl-3">
              <div class="card carte" style="--c: #4caf7d"><div class="card-body">
                <div class="d-flex justify-content-between">
                  <div>
                    <div class="titre">Application</div>
                    <div class="gros">En marche</div>
                  </div>
                  <i class="bi bi-hdd-network ico"></i>
                </div>
                <dl class="mt-2">
                  <dt>En marche depuis</dt><dd>{{ duree(e.application.enMarcheDepuisSecondes) }}</dd>
                  <dt>Mémoire utilisée</dt><dd>{{ e.application.memoireUtiliseeMo }} Mo sur {{ e.application.memoireMaxMo }} Mo</dd>
                  <dt>Version de Java</dt><dd>{{ e.application.java }}</dd>
                </dl>
              </div></div>
            </div>

            <div class="col-md-6 col-xl-3">
              <div class="card carte" [style.--c]="e.baseDeDonnees.ok ? '#4caf7d' : '#d9534f'"><div class="card-body">
                <div class="d-flex justify-content-between">
                  <div>
                    <div class="titre">Base de données</div>
                    <div class="gros" [class.text-danger]="!e.baseDeDonnees.ok">{{ e.baseDeDonnees.ok ? 'Connectée' : 'Injoignable' }}</div>
                  </div>
                  <i class="bi bi-database ico"></i>
                </div>
                <dl class="mt-2" *ngIf="e.baseDeDonnees.ok">
                  <dt>Temps de réponse</dt><dd>{{ e.baseDeDonnees.tempsReponseMs }} ms</dd>
                  <dt>Taille des données</dt><dd>{{ e.baseDeDonnees.tailleMo }} Mo</dd>
                  <dt>Version de PostgreSQL</dt><dd>{{ e.baseDeDonnees.version }}</dd>
                </dl>
                <p class="mt-2 mb-0 text-danger small" *ngIf="!e.baseDeDonnees.ok">{{ e.baseDeDonnees.erreur }}</p>
              </div></div>
            </div>

            <div class="col-md-6 col-xl-3">
              <div class="card carte" [style.--c]="e.disque.alerte ? '#d9534f' : '#4caf7d'"><div class="card-body">
                <div class="d-flex justify-content-between">
                  <div>
                    <div class="titre">Espace disque</div>
                    <div class="gros" [class.text-danger]="e.disque.alerte">{{ e.disque.libreGo }} Go libres</div>
                  </div>
                  <i class="bi bi-device-hdd ico"></i>
                </div>
                <div class="progress mt-2" style="height: 8px;">
                  <div class="progress-bar" [class.bg-danger]="e.disque.alerte" [class.bg-success]="!e.disque.alerte"
                       [style.width.%]="100 - (e.disque.pourcentageLibre || 0)"></div>
                </div>
                <small class="text-muted">{{ e.disque.libreGo }} Go libres sur {{ e.disque.totalGo }} Go</small>
                <p class="mt-2 mb-0 text-danger small" *ngIf="e.disque.alerte">Moins de 1 Go libre : libérez de la place.</p>
              </div></div>
            </div>

            <div class="col-md-6 col-xl-3">
              <div class="card carte" [style.--c]="e.sauvegarde.alerte ? '#e89a3c' : '#4caf7d'"><div class="card-body">
                <div class="d-flex justify-content-between">
                  <div>
                    <div class="titre">Dernière sauvegarde</div>
                    <div class="gros" [class.text-warning]="e.sauvegarde.alerte">{{ e.sauvegarde.derniere ? (e.sauvegarde.derniere | date:'dd/MM/yyyy HH:mm') : 'Aucune' }}</div>
                  </div>
                  <i class="bi bi-cloud-arrow-up ico"></i>
                </div>
                <dl class="mt-2" *ngIf="e.sauvegarde.derniere">
                  <dt>Fichier</dt><dd class="text-break small">{{ e.sauvegarde.fichier }} ({{ e.sauvegarde.tailleMo }} Mo)</dd>
                  <dt>Copies conservées</dt><dd>{{ e.sauvegarde.nombre }}</dd>
                </dl>
                <p class="mt-2 mb-0 small" [class.text-warning]="e.sauvegarde.alerte" *ngIf="e.sauvegarde.message">{{ e.sauvegarde.message }}</p>
                <small class="text-muted d-block mt-1">Dossier : {{ e.sauvegarde.dossier }}</small>
              </div></div>
            </div>
          </div>

          <div class="row g-3 mt-1">
            <div class="col-lg-6">
              <div class="card carte" [style.--c]="e.emails.alerte ? '#d9534f' : (e.emails.actif ? '#4caf7d' : '#9aa5b1')"><div class="card-body">
                <div class="titre mb-2">Emails</div>
                <div class="gros" [class.text-danger]="e.emails.alerte">{{ e.emails.actif ? 'Actifs' : (e.emails.configure ? 'Suspendus' : 'Non configurés') }}</div>
                <p class="mb-0 small text-muted" *ngIf="e.emails.configure">{{ e.emails.envoyes7Jours }} envoyé(s), {{ e.emails.echecs7Jours }} échec(s) ces 7 jours.</p>
                <p class="mb-0 small text-danger" *ngIf="e.emails.derniereErreur">Dernière erreur : {{ e.emails.derniereErreur }}</p>
                <p class="mb-0 small text-muted" *ngIf="!e.emails.configure">Les notifications restent dans l'application. Voir Paramètres pour activer les emails.</p>
              </div></div>
            </div>
            <div class="col-lg-6">
              <div class="card carte" style="--c: #3d9fa8"><div class="card-body">
                <div class="titre mb-2">Données de la mutuelle</div>
                <div class="row text-center">
                  <div class="col-4"><div class="gros">{{ e.donnees.membresActifs }}</div><small class="text-muted">membres actifs</small></div>
                  <div class="col-4"><div class="gros">{{ e.donnees.operations }}</div><small class="text-muted">opérations</small></div>
                  <div class="col-4"><div class="gros">{{ e.donnees.recus }}</div><small class="text-muted">reçus</small></div>
                </div>
              </div></div>
            </div>
            <div class="col-lg-6">
              <div class="card carte" style="--c: #5b7fd1"><div class="card-body">
                <div class="titre mb-2">Comment faire une sauvegarde ?</div>
                <p class="mb-1 small">Double-cliquez sur <strong>sauvegarder.bat</strong> (dossier <em>backend</em>) : il copie la base et les reçus dans le dossier « sauvegardes ».</p>
                <p class="mb-0 small text-muted">Pour qu'elle soit faite chaque nuit automatiquement, suivez le guide d'installation (planificateur de tâches Windows).</p>
              </div></div>
            </div>
          </div>

          <p class="text-muted small text-end mt-3">Heure du serveur : {{ e.heureServeur | date:'dd/MM/yyyy HH:mm:ss' }}</p>
        </ng-container>
      </div>
    </div>
  `
})
export class SanteComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  e: any = null;
  chargement = false;
  erreur = '';
  private minuteur?: any;

  get toutVaBien(): boolean {
    return !!this.e && this.e.baseDeDonnees.ok && !this.e.disque.alerte && !this.e.sauvegarde.alerte && !this.e.emails?.alerte;
  }

  ngOnInit(): void {
    this.charger();
    this.minuteur = setInterval(() => this.charger(), 60000);
  }

  ngOnDestroy(): void {
    if (this.minuteur) clearInterval(this.minuteur);
  }

  charger(): void {
    this.chargement = true;
    this.http.get<any>(`${environment.apiUrl}/admin/sante`).subscribe({
      next: (r) => { this.e = r; this.erreur = ''; this.chargement = false; },
      error: (err) => {
        this.erreur = err?.error?.message || 'Impossible de contacter le serveur.';
        this.chargement = false;
      }
    });
  }

  duree(secondes: number): string {
    const j = Math.floor(secondes / 86400);
    const h = Math.floor((secondes % 86400) / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    if (j > 0) return `${j} j ${h} h`;
    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
  }
}
