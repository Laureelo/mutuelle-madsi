import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pret, PretCreate, PretUpdate, PretFilter, Remboursement, RemboursementCreate } from '../models/pret.model';
import { PageResponse } from '../models/common.model';

@Injectable({
  providedIn: 'root'
})
export class PretService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/prets`;

  getAll(filter?: PretFilter): Observable<PageResponse<Pret>> {
    let params = new HttpParams();

    if (filter) {
      if (filter.membreId) params = params.set('membreId', filter.membreId.toString());
      if (filter.statut) params = params.set('statut', filter.statut);
      if (filter.montantMin) params = params.set('montantMin', filter.montantMin.toString());
      if (filter.montantMax) params = params.set('montantMax', filter.montantMax.toString());
      if (filter.dateDebut) params = params.set('dateDebut', filter.dateDebut);
      if (filter.dateFin) params = params.set('dateFin', filter.dateFin);
      if (filter.page !== undefined) params = params.set('page', filter.page.toString());
      if (filter.size !== undefined) params = params.set('size', filter.size.toString());
    }

    return this.http.get<PageResponse<Pret>>(this.BASE_PATH, { params });
  }

  getById(id: number): Observable<Pret> {
    return this.http.get<Pret>(`${this.BASE_PATH}/${id}`);
  }

  create(pret: PretCreate): Observable<Pret> {
    return this.http.post<Pret>(this.BASE_PATH, pret);
  }

  /** Confirmation par le président (admin) d'un prêt au-dessus du seuil. */
  confirmer(id: number): Observable<Pret> {
    return this.http.post<Pret>(`${this.BASE_PATH}/${id}/confirmer`, {});
  }

  approuver(id: number): Observable<Pret> {
    return this.http.post<Pret>(`${this.BASE_PATH}/${id}/approuver`, {});
  }

  rejeter(id: number, motif: string): Observable<Pret> {
    return this.http.post<Pret>(`${this.BASE_PATH}/${id}/rejeter`, { motif });
  }

  getByMembre(membreId: number): Observable<Pret[]> {
    return this.http.get<Pret[]>(`${this.BASE_PATH}/membre/${membreId}`);
  }

  verser(id: number, data: { modePaiement: 'ESPECES' | 'MOBILE_MONEY', reference: string, dateDecaissement: string, photoPreuve?: string }): Observable<any> {
    return this.http.post<any>(`${this.BASE_PATH}/${id}/verser`, data);
  }
}
