import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Operation, OperationCreate, OperationFilter, SoldeResponse } from '../models/operation.model';
import { PageResponse } from '../models/common.model';

@Injectable({
  providedIn: 'root'
})
export class OperationService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/operations`;

  getAll(filter?: OperationFilter): Observable<PageResponse<Operation>> {
    let params = new HttpParams();

    if (filter) {
      if (filter.q) params = params.set('q', filter.q);
      if (filter.sens) params = params.set('sens', filter.sens);
      if (filter.typeOp) params = params.set('typeOp', filter.typeOp);
      if (filter.mode) params = params.set('mode', filter.mode);
      if (filter.statut) params = params.set('statut', filter.statut);
      if (filter.dateFrom) params = params.set('dateFrom', filter.dateFrom);
      if (filter.dateTo) params = params.set('dateTo', filter.dateTo);
      if (filter.page !== undefined) params = params.set('page', filter.page.toString());
      if (filter.size !== undefined) params = params.set('size', filter.size.toString());
    }

    return this.http.get<PageResponse<Operation>>(this.BASE_PATH, { params });
  }

  createApport(data: { montant: number; modePaiement: string; reference?: string; membreId?: number }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/caisse/apports`, data);
  }

  createRecette(data: { montant: number; modePaiement: string; reference?: string; membreId?: number }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/caisse/recettes`, data);
  }

  createDepense(data: { montant: number; modePaiement: string; reference?: string; membreId?: number }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/caisse/depenses`, data);
  }

  /** Dépense rattachée à une prestation ou une activité (manifestation). */
  createDepenseManifestation(data: { montant: number; modePaiement: string; reference?: string; membreId?: number; objetId: number }): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/operations/depenses`, { ...data, objetType: 'manifestation' });
  }

  /** Le président (admin) confirme une dépense au-dessus du seuil. */
  confirmer(id: number): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/operations/${id}/confirmer`, {});
  }

  /** Le président (admin) refuse une dépense au-dessus du seuil. */
  refuser(id: number, motif: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/operations/${id}/refuser`, { motif });
  }

  /** Annulation d'une opération (motif obligatoire). */
  annuler(id: number, motif: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/operations/${id}/annuler`, { motif });
  }

  /** Solde de la caisse aujourd'hui, ou à la fin de la journée `date` (AAAA-MM-JJ). */
  getSolde(date?: string): Observable<SoldeResponse> {
    const params: any = date ? { date } : {};
    return this.http.get<SoldeResponse>(`${this.BASE_PATH}/solde`, { params });
  }

}
