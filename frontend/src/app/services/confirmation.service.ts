import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConfirmationsEnAttente {
  prets: number;
  depenses: number;
  total: number;
  seuil: number;
}

/** Ce qui attend la confirmation du président (administrateur) : prêts et dépenses au-dessus du seuil. */
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private http = inject(HttpClient);

  enAttente(): Observable<ConfirmationsEnAttente> {
    return this.http.get<ConfirmationsEnAttente>(`${environment.apiUrl}/confirmations/en-attente`);
  }
}
