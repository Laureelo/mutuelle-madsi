import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Cotisation, CotisationCreate, CotisationUpdate, CotisationFilter, DeclarerCotisationInput, CotisationStats, StatutCotisation } from '../models/cotisation.model';
import { PageResponse } from '../models/common.model';

@Injectable({
  providedIn: 'root'
})
export class CotisationService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/cotisations`;

  getAll(filter?: CotisationFilter): Observable<PageResponse<Cotisation>> {
    // Récupérer toutes les cotisations via le nouvel endpoint /toutes
    return this.http.get<Cotisation[]>(`${this.BASE_PATH}/toutes`).pipe(
      map(cotisations => {
        // Normaliser les données: si periodes existe mais pas periode, créer periode
        // Et mapper le statut String vers l'enum StatutCotisation
        cotisations = cotisations.map(c => ({
          ...c,
          periode: c.periode || (c.periodes ? c.periodes.split(',')[0] : ''),
          statut: (c.statut as StatutCotisation) || StatutCotisation.EN_ATTENTE
        }));

        // Trier par date de paiement décroissante (plus récent en premier)
        cotisations.sort((a, b) => {
          const dateA = a.datePaiement ? new Date(a.datePaiement).getTime() : 0;
          const dateB = b.datePaiement ? new Date(b.datePaiement).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return (b.id || 0) - (a.id || 0);
        });

        // Appliquer les filtres côté frontend
        let filtered = [...cotisations];

        if (filter?.periode) {
          filtered = filtered.filter(c => c.periodes?.includes(filter.periode!) || c.periode?.includes(filter.periode!));
        }
        if (filter?.statut) {
          filtered = filtered.filter(c => c.statut === filter.statut);
        }
        if (filter?.modePaiement) {
          filtered = filtered.filter(c => c.modePaiement === filter.modePaiement);
        }

        // Pagination côté frontend
        const page = filter?.page || 0;
        const size = filter?.size || 10;
        const start = page * size;
        const end = start + size;
        const content = filtered.slice(start, end);

        const totalPages = Math.ceil(filtered.length / size);
        return {
          content,
          totalElements: filtered.length,
          totalPages,
          size,
          number: page,
          first: page === 0,
          last: page >= totalPages - 1 || totalPages === 0
        };
      }),
      catchError(err => {
        console.error('Erreur getAll:', err);
        // En cas d'erreur, retourner une page vide
        return of({
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: filter?.size || 10,
          number: filter?.page || 0,
          first: true,
          last: true
        });
      })
    );
  }

  getById(id: number): Observable<Cotisation> {
    return this.http.get<Cotisation>(`${this.BASE_PATH}/${id}`);
  }

  create(cotisation: CotisationCreate): Observable<Cotisation> {
    // Normaliser la période au format "YYYY-MM"
    const normalizedPeriode = cotisation.periode.trim();
    
    const payload = {
      membreId: cotisation.membreId,
      periode: normalizedPeriode,
      montant: cotisation.montant,
      datePaiement: cotisation.datePaiement,
      modePaiement: cotisation.modePaiement,
      reference: cotisation.reference || null,
      statut: cotisation.statut || null
    };
    return this.http.post<Cotisation>(this.BASE_PATH, payload);
  }

  update(id: number, cotisation: CotisationUpdate): Observable<Cotisation> {
    return this.http.put<Cotisation>(`${this.BASE_PATH}/${id}`, cotisation);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.BASE_PATH}/${id}`);
  }

  valider(id: number): Observable<Cotisation> {
    return this.http.post<Cotisation>(`${this.BASE_PATH}/${id}/valider`, {});
  }

  rejeter(id: number, motif: string): Observable<Cotisation> {
    return this.http.post<Cotisation>(`${this.BASE_PATH}/${id}/annuler`, { motif });
  }

  getByMembre(membreId: number): Observable<Cotisation[]> {
    return this.http.get<Cotisation[]>(`${this.BASE_PATH}/membre/${membreId}`);
  }

  getTotalByPeriode(periode: string): Observable<{ total: number }> {
    return this.http.get<{ total: number }>(`${this.BASE_PATH}/total/periode/${periode}`);
  }

  /**
   * Vérifie si une cotisation existe déjà pour un membre et une période
   * Utilise l'endpoint backend dédié pour une vérification fiable
   * Retourne la cotisation existante si elle existe, null sinon
   */
  checkExisting(membreId: number, periode: string): Observable<Cotisation | null> {
    // Normaliser la période au format "YYYY-MM"
    const normalizedPeriode = periode.trim();

    // Utiliser l'endpoint backend dédié pour une vérification fiable
    return this.http.get<{ exists: boolean; cotisation: Cotisation | null }>(
      `${this.BASE_PATH}/exists/membre/${membreId}/periode/${encodeURIComponent(normalizedPeriode)}`
    ).pipe(
      map(response => response.exists ? response.cotisation : null),
      catchError(err => {
        console.warn('Erreur lors de la vérification d\'existence:', err);
        // En cas d'erreur, retourner null pour permettre la tentative de création
        return of(null);
      })
    );
  }

  // ===== NOUVEAUX ENDPOINTS POUR DÉCLARATION PAR LES MEMBRES =====

  /**
   * Déclarer une cotisation pour un ou plusieurs mois
   */
  declarer(input: DeclarerCotisationInput): Observable<Cotisation> {
    return this.http.post<Cotisation>(`${this.BASE_PATH}/declarer`, input);
  }

  /**
   * Valider une cotisation (trésorier)
   */
  validerCotisation(id: number, tresorierId: number): Observable<Cotisation> {
    return this.http.post<Cotisation>(`${this.BASE_PATH}/${id}/valider-cotisation`, { tresorierId });
  }

  /**
   * Rejeter une cotisation (trésorier)
   */
  rejeterCotisation(id: number, tresorierId: number, motif: string): Observable<Cotisation> {
    return this.http.post<Cotisation>(`${this.BASE_PATH}/${id}/rejeter`, { tresorierId, motif });
  }

  /**
   * Récupérer mes cotisations
   */
  getMesCotisations(membreId: number): Observable<Cotisation[]> {
    return this.http.get<Cotisation[]>(`${this.BASE_PATH}/mes-cotisations`, {
      params: { membreId: membreId.toString() }
    }).pipe(
      map(cotisations => {
        // Normaliser le statut String vers enum et trier par date de paiement décroissante
        return cotisations.map(c => ({
          ...c,
          statut: (c.statut as StatutCotisation) || StatutCotisation.EN_ATTENTE
        })).sort((a, b) => {
          const dateA = a.datePaiement ? new Date(a.datePaiement).getTime() : 0;
          const dateB = b.datePaiement ? new Date(b.datePaiement).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return (b.id || 0) - (a.id || 0);
        });
      })
    );
  }

  /**
   * Récupérer les cotisations en attente (trésorier)
   */
  getCotisationsEnAttente(): Observable<Cotisation[]> {
    return this.http.get<Cotisation[]>(`${this.BASE_PATH}/en-attente`);
  }

  /**
   * Récupérer toutes les cotisations (trésorier)
   */
  getToutesCotisations(): Observable<Cotisation[]> {
    return this.http.get<Cotisation[]>(`${this.BASE_PATH}/toutes`);
  }

  /**
   * Vérifier les mois non payés pour un membre
   */
  getMoisNonPayes(membreId: number, annee: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.BASE_PATH}/mois-non-payes`, {
      params: { membreId: membreId.toString(), annee: annee.toString() }
    });
  }

  /**
   * Obtenir les statistiques des cotisations
   */
  getStats(): Observable<CotisationStats> {
    // Récupérer toutes les cotisations directement depuis le backend pour calculer les stats
    return this.http.get<Cotisation[]>(`${this.BASE_PATH}/toutes`).pipe(
      map(cotisations => ({
        total: cotisations.length,
        enAttente: cotisations.filter(c => c.statut === 'EN_ATTENTE').length,
        payees: cotisations.filter(c => c.statut === 'PAYE').length,
        enRetard: cotisations.filter(c => c.statut === 'EN_RETARD').length,
        montantTotal: cotisations.reduce((sum, c) => sum + c.montant, 0)
      })),
      catchError(err => {
        console.error('Erreur chargement stats:', err);
        return of({
          total: 0,
          enAttente: 0,
          payees: 0,
          enRetard: 0,
          montantTotal: 0
        });
      })
    );
  }
}
