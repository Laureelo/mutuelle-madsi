import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Membre, MembreCreate, MembreUpdate, MembreFilter } from '../models/membre.model';
import { PageResponse } from '../models/common.model';

@Injectable({
  providedIn: 'root'
})
export class MembreService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/membres`;

  getAll(filter?: MembreFilter): Observable<PageResponse<Membre>> {
    let params = new HttpParams();

    // Le backend attend toujours 'q' pour la recherche (avec valeur par défaut "")
    if (filter) {
      // Toujours passer 'q', même si vide
      params = params.set('q', filter.search || '');
      if (filter.etatCompte) params = params.set('etatCompte', filter.etatCompte);
      if (filter.role) params = params.set('role', filter.role);
      if (filter.page !== undefined) params = params.set('page', filter.page.toString());
      if (filter.size !== undefined) params = params.set('size', filter.size.toString());
    } else {
      // Par défaut, charger tous les membres avec pagination
      params = params.set('q', '');
      params = params.set('page', '0');
      params = params.set('size', '10');
    }

    return this.http.get<PageResponse<Membre>>(this.BASE_PATH, { params });
  }

  getById(id: number): Observable<Membre> {
    return this.http.get<Membre>(`${this.BASE_PATH}/${id}`);
  }

  create(membre: MembreCreate): Observable<Membre> {
    return this.http.post<Membre>(this.BASE_PATH, membre);
  }

  update(id: number, membre: MembreUpdate): Observable<Membre> {
    return this.http.put<Membre>(`${this.BASE_PATH}/${id}`, membre);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.BASE_PATH}/${id}`);
  }

  /**
   * Validation par la trésorerie : passe de EN_ATTENTE à VALIDE_PAR_TRESORERIE
   */
  validerParTresorerie(id: number, tresorierId: number = 1): Observable<Membre> {
    // TODO: Récupérer tresorierId depuis le token JWT ou le service d'authentification
    return this.http.post<Membre>(`${this.BASE_PATH}/${id}/valider-tresorerie?tresorierId=${tresorierId}`, {});
  }

  /**
   * Activation par l'administrateur métier : passe de VALIDE_PAR_TRESORERIE à ACTIF
   */
  validateMembre(id: number, validateurId: number = 1): Observable<Membre> {
    // TODO: Récupérer validateurId depuis le token JWT ou le service d'authentification
    // L'identité de l'admin est déduite du jeton par le serveur
    return this.http.post<Membre>(`${this.BASE_PATH}/${id}/activer`, {});
  }

  /** Administrateur : génère un mot de passe provisoire à transmettre au membre. */
  reinitialiserMotDePasse(id: number): Observable<{ motDePasseProvisoire: string }> {
    return this.http.post<{ motDePasseProvisoire: string }>(`${this.BASE_PATH}/${id}/reinitialiser-mot-de-passe`, {});
  }

  deactivateMembre(id: number, adminId: number = 1): Observable<Membre> {
    // TODO: Récupérer adminId depuis le token JWT ou le service d'authentification
    return this.http.post<Membre>(`${this.BASE_PATH}/${id}/desactiver?adminId=${adminId}`, {});
  }

  reactivateMembre(id: number, adminId: number = 1): Observable<Membre> {
    return this.http.post<Membre>(`${this.BASE_PATH}/${id}/reactiver?adminId=${adminId}`, {});
  }

  /** Situation du membre : à jour de ses cotisations, mois impayés, prêts en cours. */
  getSituation(id: number): Observable<any> {
    return this.http.get<any>(`${this.BASE_PATH}/${id}/situation`);
  }

  getSolde(id: number): Observable<{ solde: number }> {
    return this.http.get<{ solde: number }>(`${this.BASE_PATH}/${id}/solde`);
  }

}
