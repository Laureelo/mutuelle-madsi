import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Echeance, RemboursementPret, RemboursementCreate, RemboursementAck } from '../models/echeance.model';

@Injectable({
  providedIn: 'root'
})
export class RemboursementService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';

  // Obtenir les échéances d'un prêt
  getEcheancesByPret(pretId: number): Observable<Echeance[]> {
    return this.http.get<Echeance[]>(`${this.API_URL}/prets/${pretId}/echeancier`);
  }

  // Obtenir les remboursements d'une échéance
  getRemboursementsByEcheance(echeanceId: number): Observable<RemboursementPret[]> {
    return this.http.get<RemboursementPret[]>(`${this.API_URL}/echeances/${echeanceId}/remboursements`);
  }

  // Enregistrer un remboursement (trésorier - ESPECES ou validation MOBILE_MONEY)
  enregistrerRemboursement(data: RemboursementCreate): Observable<RemboursementAck> {
    return this.http.post<RemboursementAck>(`${this.API_URL}/remboursements`, data);
  }

  // Reste dû d'une échéance (tient compte des paiements déjà enregistrés)
  getSolde(echeanceId: number): Observable<{ montantDu: number; cumulePaye: number; reste: number }> {
    return this.http.get<{ montantDu: number; cumulePaye: number; reste: number }>(`${this.API_URL}/echeances/${echeanceId}/solde`);
  }

  // Déclarer un paiement par mobile money (membre) : il est ensuite validé par le trésorier
  soumettreMobileMoney(echeanceId: number, montant: number, reference: string): Observable<RemboursementPret> {
    return this.http.post<RemboursementPret>(`${this.API_URL}/remboursements/mobile/submit`, { echeanceId, montant, reference });
  }

  // Valider un remboursement mobile money (trésorier)
  validerMobileMoney(remboursementId: number): Observable<RemboursementAck> {
    return this.http.post<RemboursementAck>(`${this.API_URL}/remboursements/${remboursementId}/valider`, {});
  }

  // Rejeter un remboursement mobile money (trésorier)
  rejeterMobileMoney(remboursementId: number, motif: string): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/remboursements/${remboursementId}/rejeter`, { motif });
  }

  // Récupérer tous les remboursements en attente (trésorier)
  getPendingRemboursements(): Observable<RemboursementPret[]> {
    return this.http.get<RemboursementPret[]>(`${this.API_URL}/remboursements/pending`);
  }
}
