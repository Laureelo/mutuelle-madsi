import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { DialogService } from './dialog.service';

/**
 * Ouverture des reçus de versement (PDF). Le PDF est protégé : il est récupéré avec le jeton de
 * connexion puis affiché dans un nouvel onglet (une simple balise <a href> ne pourrait pas envoyer le jeton).
 *
 * L'onglet est ouvert IMMÉDIATEMENT au clic (sinon le navigateur le bloque) puis rempli quand le PDF arrive.
 */
@Injectable({ providedIn: 'root' })
export class RecuService {
  private dialog = inject(DialogService);
  private http = inject(HttpClient);

  /** Ouvre le reçu du versement (décaissement) d'un prêt. */
  ouvrirRecuVersementPret(pretId: number): void {
    const onglet = window.open('', '_blank');
    this.http.get<{ operationId: number }>(`${environment.apiUrl}/prets/${pretId}/recu-versement`).subscribe({
      next: (r) => this.afficher(r.operationId, onglet),
      error: () => {
        onglet?.close();
        this.dialog.erreur('Reçu de versement indisponible pour ce prêt.');
      }
    });
  }

  /** Ouvre le reçu d'une opération financière (cotisation, adhésion, remboursement...). */
  ouvrirOperation(operationId: number | undefined | null): void {
    if (!operationId) {
      this.dialog.erreur('Aucun reçu disponible pour cette opération.');
      return;
    }
    this.afficher(operationId, window.open('', '_blank'));
  }

  private afficher(operationId: number, onglet: Window | null): void {
    this.http.get(`${environment.apiUrl}/operations/${operationId}/recu/pdf`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        if (onglet) {
          onglet.location.href = url;
        } else {
          window.location.href = url;
        }
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
      },
      error: (err) => {
        onglet?.close();
        this.dialog.erreur(err?.status === 403
          ? 'Vous n\'avez pas accès à ce reçu.'
          : 'Reçu indisponible pour le moment. Veuillez réessayer.');
      }
    });
  }
}
