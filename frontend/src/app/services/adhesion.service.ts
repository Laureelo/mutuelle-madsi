import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Adhesion, AdhesionCreate, AdhesionStats } from '../models/adhesion.model';

@Injectable({
  providedIn: 'root'
})
export class AdhesionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/adhesions`;

  /**
   * Déclarer un paiement d'adhésion (VISITEUR)
   */
  declarer(data: AdhesionCreate): Observable<any> {
    return this.http.post(`${this.apiUrl}/declarer`, data);
  }

  /**
   * Récupérer mes adhésions
   */
  getMesAdhesions(): Observable<Adhesion[]> {
    return this.http.get<Adhesion[]>(`${this.apiUrl}/me`);
  }

  /**
   * Récupérer toutes les adhésions (trésorier/admin)
   */
  getAll(): Observable<Adhesion[]> {
    return this.http.get<Adhesion[]>(this.apiUrl);
  }

  /**
   * Récupérer les adhésions en attente (trésorier)
   */
  getEnAttente(): Observable<Adhesion[]> {
    return this.http.get<Adhesion[]>(`${this.apiUrl}/en-attente`);
  }

  /**
   * Récupérer une adhésion par ID
   */
  getById(id: number): Observable<Adhesion> {
    return this.http.get<Adhesion>(`${this.apiUrl}/${id}`);
  }

  /**
   * Valider une adhésion (trésorier)
   */
  valider(id: number, tresorierId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/valider?tresorierId=${tresorierId}`, {});
  }

  /**
   * Rejeter une adhésion (trésorier)
   */
  rejeter(id: number, tresorierId: number, motifRejet: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/rejeter`, {
      tresorierId,
      motifRejet
    });
  }

  /**
   * Récupérer les statistiques
   */
  getStats(): Observable<AdhesionStats> {
    return this.http.get<AdhesionStats>(`${this.apiUrl}/stats`);
  }

  /**
   * Récupérer les adhésions d'un membre par son ID (trésorier/admin)
   */
  getByMembreId(membreId: number): Observable<Adhesion[]> {
    return this.http.get<Adhesion[]>(`${this.apiUrl}/membre/${membreId}`);
  }
}
