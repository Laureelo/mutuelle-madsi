import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export type TypePreuve = 'cotisations' | 'adhesions' | 'prets' | 'operations';

/**
 * Les listes n'embarquent plus les images des preuves de paiement (elles pèseraient plusieurs Mo) :
 * elles indiquent seulement « aPreuve ». L'image se charge ici, à la demande, à l'ouverture de la preuve.
 */
@Injectable({ providedIn: 'root' })
export class PreuveService {
  private http = inject(HttpClient);

  charger(type: TypePreuve, id: number): Observable<string> {
    return this.http
      .get<{ data: string | null }>(`${environment.apiUrl}/preuves/${type}/${id}`)
      .pipe(map(r => r.data ?? ''));
  }
}
