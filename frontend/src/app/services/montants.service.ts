import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Montants fixés par le règlement intérieur et modifiables par l'administrateur dans « Paramètres » :
 * cotisation mensuelle et droit d'adhésion. Lus auprès du serveur (point d'accès public, utilisable
 * aussi sur la page d'inscription). Les valeurs du règlement servent de repli avant la réponse.
 */
@Injectable({ providedIn: 'root' })
export class MontantsService {
  private http = inject(HttpClient);

  cotisation = 1000;
  adhesion = 2000;
  devise = 'FCFA';
  nom = 'MADSI';

  constructor() {
    if (typeof window !== 'undefined') {
      this.charger();
    }
  }

  charger(): void {
    this.http.get<any>(`${environment.apiUrl}/settings/public`).subscribe({
      next: (s) => {
        if (s?.montantCotisation > 0) this.cotisation = s.montantCotisation;
        if (s?.montantAdhesion > 0) this.adhesion = s.montantAdhesion;
        if (s?.devise) this.devise = s.devise;
        if (s?.nom) this.nom = s.nom;
      },
      error: () => { /* on garde les valeurs du règlement */ }
    });
  }
}
