import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Notif {
  id: number;
  type: 'RAPPEL' | 'ALERTE' | 'INFO';
  sujet: string;
  messageRendu: string;
  etat: 'ENVOYE' | 'LU' | 'ECHEC';   // ENVOYE = non lue
  dateEnvoi: string;
  topicType?: string;
  topicId?: number;
}

/** Notifications dans l'application (la cloche). */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  nonLues(membreId: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`, { params: new HttpParams().set('destinataireId', membreId) });
  }

  liste(membreId: number, size = 10): Observable<{ content: Notif[] }> {
    return this.http.get<{ content: Notif[] }>(this.base, {
      params: new HttpParams().set('destinataireId', membreId).set('page', 0).set('size', size)
    });
  }

  marquerLue(id: number): Observable<any> {
    return this.http.post(`${this.base}/${id}/lu`, {});
  }

  toutMarquerLu(membreId: number): Observable<any> {
    return this.http.post(`${this.base}/tout-lu`, {}, { params: new HttpParams().set('destinataireId', membreId) });
  }

  /** Envoie une information aux membres (trésorier, administrateur). */
  envoyerAnnonce(a: { titre: string; message: string; audience: string; parEmail: boolean }): Observable<{ destinataires: number; emailsActifs: boolean; emailDemande: boolean }> {
    return this.http.post<any>(`${environment.apiUrl}/annonces`, a);
  }
}
