import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RapportParams {
  periodeDebut: string;  // YYYY-MM-DD
  periodeFin: string;  // YYYY-MM-DD
  type: 'FINANCIER' | 'STATISTIQUE' | 'METIER' | 'FIN_DE_MANDAT';
  /** Contenu du rapport : JOURNAL, COTISATIONS, PRETS, MEMBRES, ACTIVITES ou ANNUEL. */
  modele?: 'JOURNAL' | 'COTISATIONS' | 'PRETS' | 'MEMBRES' | 'ACTIVITES' | 'ANNUEL';
  filtres?: {
    membreId?: number;
    sens?: 'ENTREE' | 'SORTIE';
    typesOperation?: string[];  // COTISATION, APPORT, RECETTE, DEPENSE, REMBOURSEMENT_PRET
  };
  export?: {
    format?: 'PDF' | 'CSV' | 'XLSX';
    envoyerParEmail?: boolean;
    destinatairesEmail?: string[];
  };
}

export interface RapportExport {
  id: number;
  type: string;
  periode: string;
  format: string;
  genereLe: string;
  fichierPdfUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RapportService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/rapports`;

  generer(params: RapportParams): Observable<RapportExport> {
    return this.http.post<RapportExport>(`${this.BASE_PATH}/generer`, params);
  }

  telecharger(id: number): Observable<Blob> {
    return this.http.get(`${this.BASE_PATH}/exports/${id}/file`, { responseType: 'blob' });
  }
}
















