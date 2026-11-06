import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Manifestation, ManifestationCreate, ManifestationUpdate, ManifestationFilter } from '../models/manifestation.model';
import { PageResponse } from '../models/common.model';

@Injectable({
  providedIn: 'root'
})
export class ManifestationService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/manifestations`;

  getAll(filter?: ManifestationFilter): Observable<PageResponse<Manifestation>> {
    let params = new HttpParams();

    if (filter) {
      if (filter.q) params = params.set('q', filter.q);
      if (filter.statut) params = params.set('statut', filter.statut);
      if (filter.from) params = params.set('from', filter.from);
      if (filter.to) params = params.set('to', filter.to);
      if (filter.page !== undefined) params = params.set('page', filter.page.toString());
      if (filter.size !== undefined) params = params.set('size', filter.size.toString());
    } else {
      // Par défaut, passer q vide pour éviter les erreurs
      params = params.set('q', '');
    }

    return this.http.get<PageResponse<Manifestation>>(this.BASE_PATH, { params });
  }

  getById(id: number): Observable<Manifestation> {
    return this.http.get<Manifestation>(`${this.BASE_PATH}/${id}`);
  }

  create(manifestation: ManifestationCreate): Observable<Manifestation> {
    return this.http.post<Manifestation>(this.BASE_PATH, manifestation);
  }

  update(id: number, manifestation: ManifestationUpdate): Observable<Manifestation> {
    return this.http.put<Manifestation>(`${this.BASE_PATH}/${id}`, manifestation);
  }

  valider(id: number): Observable<Manifestation> {
    return this.http.post<Manifestation>(`${this.BASE_PATH}/${id}/valider`, {});
  }

  rejeter(id: number, motif?: string): Observable<Manifestation> {
    return this.http.post<Manifestation>(`${this.BASE_PATH}/${id}/rejeter`, { motif: motif || '-' });
  }

  /**
   * Annulation par le membre déclarant (sans passer par le trésorier)
   */
  annulerParMembre(id: number, membreId: number): Observable<Manifestation> {
    return this.http.post<Manifestation>(`${this.BASE_PATH}/${id}/annuler?membreId=${membreId}`, {});
  }

  /**
   * Clôture de la manifestation par le trésorier
   */
  cloturer(id: number, tresorierId: number, montantPrevu: number, montantReel: number, materiaux?: string, remarques?: string): Observable<Manifestation> {
    return this.http.post<Manifestation>(`${this.BASE_PATH}/${id}/cloturer`, {
      tresorierId,
      montantPrevu,
      montantReel,
      materiaux: materiaux || '',
      remarques: remarques || ''
    });
  }

}
