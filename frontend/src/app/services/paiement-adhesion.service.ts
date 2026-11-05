import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  PaiementAdhesion,
  EnregistrerPaiementDTO,
  RejeterPaiementDTO
} from '../models/paiement-adhesion.model';
import { PageResponse } from '../models/common.model';

@Injectable({
  providedIn: 'root'
})
export class PaiementAdhesionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/paiements-adhesion`;

  /**
   * Enregistrer un paiement d'adhésion (trésorier)
   */
  enregistrerPaiement(data: EnregistrerPaiementDTO): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  /**
   * Récupérer tous les paiements en attente de validation (admin métier)
   */
  getPaiementsEnAttente(page: number = 0, size: number = 10): Observable<PageResponse<PaiementAdhesion>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<PaiementAdhesion>>(`${this.apiUrl}/en-attente`, { params });
  }

  /**
   * Compter les paiements en attente (admin métier)
   */
  countPaiementsEnAttente(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/en-attente/count`);
  }

  /**
   * Valider un paiement d'adhésion (admin métier)
   */
  validerPaiement(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/valider`, {});
  }

  /**
   * Rejeter un paiement d'adhésion (admin métier)
   */
  rejeterPaiement(id: number, motif: string): Observable<any> {
    const data: RejeterPaiementDTO = { motif };
    return this.http.post(`${this.apiUrl}/${id}/rejeter`, data);
  }

  /**
   * Récupérer le paiement d'adhésion d'un membre spécifique
   */
  getPaiementByMembreId(membreId: number): Observable<PaiementAdhesion> {
    return this.http.get<PaiementAdhesion>(`${this.apiUrl}/membre/${membreId}`);
  }

  /**
   * Récupérer tous les paiements (avec pagination)
   */
  getAllPaiements(page: number = 0, size: number = 10): Observable<PageResponse<PaiementAdhesion>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<PaiementAdhesion>>(this.apiUrl, { params });
  }
}
