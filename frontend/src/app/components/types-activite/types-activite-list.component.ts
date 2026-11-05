import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DialogService } from '../../services/dialog.service';

interface TypeActivite {
  id?: number;
  libelle: string;
  type: string;
  sousType: string;
  montantAlloue: number;
  lieu: string;
}

interface Categorie {
  code: string;
  nom: string;
  icone: string;
  couleur: string;
  aide: string;
}

interface Groupe {
  titre: string;
  sousTitre: string;
  categories: Categorie[];
}

@Component({
  selector: 'app-types-activite-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-content-header">
      <div class="container-fluid">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h3 class="mb-1"><i class="bi bi-tags me-2"></i>Types d'activité</h3>
            <div class="text-muted small">
              Les montants versés par la mutuelle pour chaque événement. Ils sont fixés par le règlement intérieur
              et l'Assemblée Générale.
            </div>
          </div>
          <button class="btn btn-primary" (click)="ouvrirNouveau()">
            <i class="bi bi-plus-circle me-1"></i> Nouveau type
          </button>
        </div>
      </div>
    </div>

    <div class="app-content">
      <div class="container-fluid">
        <div *ngIf="loadingTypes" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="mt-3 text-muted">Chargement...</p>
        </div>

        <div *ngIf="typeError" class="alert alert-danger d-flex justify-content-between align-items-center">
          <span><i class="bi bi-exclamation-triangle me-2"></i>{{ typeError }}</span>
          <button class="btn btn-sm btn-outline-danger" (click)="loadTypesActivite()">Réessayer</button>
        </div>

        <ng-container *ngIf="!loadingTypes && !typeError">
          <div *ngIf="typesActivite.length === 0" class="card card-body text-center text-muted py-5">
            <i class="bi bi-inbox display-4"></i>
            <p class="mt-2 mb-0">Aucun type d'activité configuré.</p>
          </div>

          <ng-container *ngFor="let g of groupes">
            <ng-container *ngIf="nbDansGroupe(g) > 0">
              <h5 class="groupe-titre">{{ g.titre }}<small>{{ g.sousTitre }}</small></h5>
              <div class="row g-3 mb-4">
                <ng-container *ngFor="let c of g.categories">
                  <div class="col-12 col-xl-6" *ngIf="deCategorie(c.code).length > 0">
                    <div class="card cat h-100" [style.--cat]="c.couleur">
                      <div class="cat-entete">
                        <span class="cat-icone"><i class="bi" [ngClass]="c.icone"></i></span>
                        <span class="fw-semibold">{{ c.nom }}</span>
                        <span class="badge rounded-pill ms-auto cat-nb">{{ deCategorie(c.code).length }}</span>
                      </div>
                      <ul class="list-unstyled mb-0">
                        <li *ngFor="let t of deCategorie(c.code)" class="ligne">
                          <div class="ligne-texte">
                            <div class="fw-semibold">{{ t.libelle }}</div>
                            <div class="small text-muted" *ngIf="t.sousType || lieuAffiche(t)">
                              {{ t.sousType }}
                              <span *ngIf="lieuAffiche(t)" class="lieu"><i class="bi bi-geo-alt"></i>{{ lieuAffiche(t) }}</span>
                            </div>
                          </div>
                          <div class="montant">{{ t.montantAlloue | number:'1.0-0' }} <small>FCFA</small></div>
                          <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary" (click)="editTypeActivite(t)" title="Modifier" aria-label="Modifier">
                              <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger" (click)="deleteTypeActivite(t)" title="Supprimer" aria-label="Supprimer">
                              <i class="bi bi-trash"></i>
                            </button>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </ng-container>
              </div>
            </ng-container>
          </ng-container>
        </ng-container>

        <!-- Formulaire -->
        <div *ngIf="showTypeActiviteForm" class="modal fade show d-block" tabindex="-1"
             style="background-color: rgba(20,30,45,.55);" (click)="closeTypeActiviteForm()">
          <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down" (click)="$event.stopPropagation()">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  <i class="bi me-2" [ngClass]="editingTypeActivite ? 'bi-pencil' : 'bi-plus-circle'"></i>
                  {{ editingTypeActivite ? 'Modifier le type' : 'Nouveau type d\\'activité' }}
                </h5>
                <button type="button" class="btn-close" (click)="closeTypeActiviteForm()" aria-label="Fermer"></button>
              </div>
              <div class="modal-body">
                <form (ngSubmit)="saveTypeActivite($event)" id="form-type">
                  <div class="mb-3">
                    <label class="form-label">Catégorie <span class="text-danger">*</span></label>
                    <select class="form-select" [(ngModel)]="typeActiviteForm.type" name="type" required>
                      <option value="">Choisir une catégorie</option>
                      <option *ngFor="let c of toutesCategories" [value]="c.code">{{ c.nom }}</option>
                    </select>
                    <div class="form-text" *ngIf="aideCategorie">{{ aideCategorie }}</div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Intitulé <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" [(ngModel)]="typeActiviteForm.libelle" name="libelle"
                           placeholder="Ex : Mariage" required />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Précision <span class="text-muted">(facultatif)</span></label>
                    <input type="text" class="form-control" [(ngModel)]="typeActiviteForm.sousType" name="sousType"
                           placeholder="Ex : conjoint, père, mère ou enfant" />
                  </div>
                  <div class="row g-3">
                    <div class="col-6">
                      <label class="form-label">Montant (FCFA) <span class="text-danger">*</span></label>
                      <input type="number" min="0" step="500" class="form-control" [(ngModel)]="typeActiviteForm.montantAlloue"
                             name="montantAlloue" required />
                    </div>
                    <div class="col-6">
                      <label class="form-label">Lieu</label>
                      <input type="text" class="form-control" [(ngModel)]="typeActiviteForm.lieu" name="lieu"
                             placeholder="Ouagadougou" />
                    </div>
                    <div class="col-12 form-text mt-1">Laissez le lieu vide s'il change à chaque fois.</div>
                  </div>

                  <div *ngIf="formError" class="alert alert-danger mt-3 mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>{{ formError }}
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" (click)="closeTypeActiviteForm()">Annuler</button>
                <button type="submit" form="form-type" class="btn btn-primary" [disabled]="saving">
                  <span *ngIf="!saving"><i class="bi bi-save me-1"></i>Enregistrer</span>
                  <span *ngIf="saving"><span class="spinner-border spinner-border-sm me-2"></span>Enregistrement...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .groupe-titre { font-weight: 600; margin: 4px 0 10px; color: #2c3e50; }
    .groupe-titre small { font-weight: 400; color: #6c757d; margin-left: 10px; font-size: .8rem; }
    .cat { --cat: #3d9fa8; border: 0; box-shadow: 0 1px 4px rgba(0,0,0,.08); border-top: 3px solid var(--cat); overflow: hidden; }
    .cat-entete { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid #eef0f3; }
    .cat-icone { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--cat) 14%, white); color: var(--cat); font-size: 1.05rem; }
    .cat-nb { background: color-mix(in srgb, var(--cat) 14%, white); color: var(--cat); font-weight: 600; }
    .ligne { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #f2f3f5; }
    .ligne:last-child { border-bottom: 0; }
    .ligne-texte { flex: 1; min-width: 0; }
    .lieu { margin-left: 8px; white-space: nowrap; }
    .lieu i { margin-right: 3px; }
    .montant { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .montant small { font-weight: 500; color: #6c757d; }
    @media (max-width: 576px) {
      .ligne { flex-wrap: wrap; }
      .ligne-texte { flex-basis: 100%; }
      .montant { margin-right: auto; }
    }
  `]
})
export class TypesActiviteListComponent implements OnInit {
  private dialog = inject(DialogService);
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/types-activite`;

  readonly groupes: Groupe[] = [
    {
      titre: 'Prestations sociales', sousTitre: 'versées aux membres selon le règlement intérieur',
      categories: [
        { code: 'MARIAGE', nom: 'Mariage', icone: 'bi-heart-fill', couleur: '#d6336c', aide: 'Mariage d\'un membre' },
        { code: 'NAISSANCE', nom: 'Naissance', icone: 'bi-balloon-heart-fill', couleur: '#e89a3c', aide: 'Naissance ou baptême' },
        { code: 'MALADIE', nom: 'Maladie', icone: 'bi-hospital', couleur: '#3d9fa8', aide: 'Visite à un membre malade' },
        { code: 'DECES', nom: 'Décès', icone: 'bi-flower1', couleur: '#6c757d', aide: 'Décès d\'un membre ou d\'un proche' },
        { code: 'RETRAITE', nom: 'Retraite', icone: 'bi-award-fill', couleur: '#8e6bbf', aide: 'Départ à la retraite' }
      ]
    },
    {
      titre: 'Activités de la mutuelle', sousTitre: 'sport et vie socioculturelle',
      categories: [
        { code: 'SPORT', nom: 'Sport', icone: 'bi-trophy-fill', couleur: '#198754', aide: 'Activités sportives' },
        { code: 'CULTURE', nom: 'Culture', icone: 'bi-music-note-beamed', couleur: '#0d6efd', aide: 'Concert, théâtre, exposition…' },
        { code: 'AUTRE', nom: 'Autre', icone: 'bi-three-dots', couleur: '#adb5bd', aide: 'Toute autre activité' }
      ]
    }
  ];
  get toutesCategories(): Categorie[] { return this.groupes.flatMap(g => g.categories); }

  typesActivite: TypeActivite[] = [];
  loadingTypes = false;
  typeError = '';
  showTypeActiviteForm = false;
  editingTypeActivite: TypeActivite | null = null;
  saving = false;
  formError = '';

  typeActiviteForm: TypeActivite = this.vide();

  private vide(): TypeActivite {
    return { libelle: '', type: '', sousType: '', montantAlloue: 0, lieu: '' };
  }

  ngOnInit(): void {
    this.loadTypesActivite();
  }

  deCategorie(code: string): TypeActivite[] {
    return this.typesActivite.filter(t => t.type === code);
  }

  nbDansGroupe(g: Groupe): number {
    return g.categories.reduce((n, c) => n + this.deCategorie(c.code).length, 0);
  }

  /** « N/A », « Variable » et vide ne sont pas des lieux : on ne les affiche pas. */
  lieuAffiche(t: TypeActivite): string {
    const l = (t.lieu || '').trim();
    return !l || /^(n\/a|variable|à définir)$/i.test(l) ? '' : l;
  }

  get aideCategorie(): string {
    return this.toutesCategories.find(c => c.code === this.typeActiviteForm.type)?.aide || '';
  }

  loadTypesActivite(): void {
    this.loadingTypes = true;
    this.typeError = '';
    this.http.get<TypeActivite[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.typesActivite = data;
        this.loadingTypes = false;
      },
      error: (err) => {
        this.typeError = 'Impossible de charger les types d\'activité : ' + (err.error?.message || err.message);
        this.loadingTypes = false;
      }
    });
  }

  ouvrirNouveau(): void {
    this.editingTypeActivite = null;
    this.typeActiviteForm = this.vide();
    this.formError = '';
    this.showTypeActiviteForm = true;
  }

  editTypeActivite(type: TypeActivite): void {
    this.editingTypeActivite = type;
    this.typeActiviteForm = { ...type, lieu: this.lieuAffiche(type) };
    this.showTypeActiviteForm = true;
    this.formError = '';
  }

  async deleteTypeActivite(type: TypeActivite): Promise<void> {
    if (await this.dialog.confirm({
      titre: 'Supprimer ce type ?',
      message: `Supprimer « ${type.libelle} — ${type.sousType} » ? Les manifestations déjà créées ne sont pas modifiées.`,
      danger: true, confirmer: 'Supprimer'
    })) {
      this.http.delete(`${this.apiUrl}/${type.id}`).subscribe({
        next: () => {
          this.dialog.succes('Type d\'activité supprimé.');
          this.loadTypesActivite();
        },
        error: (err) => {
          this.dialog.erreur('Suppression impossible : ' + (err.error?.message || err.message));
        }
      });
    }
  }

  saveTypeActivite(event: Event): void {
    event.preventDefault();
    this.formError = '';
    const f = this.typeActiviteForm;

    if (!f.libelle?.trim() || !f.type) {
      this.formError = 'Veuillez remplir la catégorie et l\'intitulé.';
      return;
    }
    if (f.montantAlloue === null || f.montantAlloue === undefined || f.montantAlloue < 0) {
      this.formError = 'Le montant doit être positif.';
      return;
    }

    this.saving = true;
    const corps: TypeActivite = { ...f, libelle: f.libelle.trim(), sousType: (f.sousType || '').trim(), lieu: (f.lieu || '').trim() || 'Variable' };
    const requete = this.editingTypeActivite?.id
      ? this.http.put<TypeActivite>(`${this.apiUrl}/${this.editingTypeActivite.id}`, corps)
      : this.http.post<TypeActivite>(this.apiUrl, corps);
    const creation = !this.editingTypeActivite?.id;

    requete.subscribe({
      next: () => {
        this.saving = false;
        this.closeTypeActiviteForm();
        this.loadTypesActivite();
        this.dialog.succes(creation ? 'Type d\'activité créé.' : 'Type d\'activité modifié.');
      },
      error: (err) => {
        this.formError = (creation ? 'Création impossible : ' : 'Modification impossible : ') + (err.error?.message || err.message);
        this.saving = false;
      }
    });
  }

  closeTypeActiviteForm(): void {
    this.showTypeActiviteForm = false;
    this.editingTypeActivite = null;
    this.formError = '';
    this.typeActiviteForm = this.vide();
  }
}
