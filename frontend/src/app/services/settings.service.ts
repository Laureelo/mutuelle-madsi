import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SettingsDTO {
  organisation?: Organisation;
  finance?: Finance;
  notifications?: Notifications;
  exports?: Exports;
}

export interface Organisation {
  nom?: string;
  emailContact?: string;
  phoneContact?: string;
  adresse?: string;
  logoUrl?: string;
  devise?: string;
}

export interface Finance {
  montantCotisation?: number;
  montantAdhesion?: number;
  seuilConfirmationDepense?: number;   // au-delà : confirmation du président (admin)
  plafondEncoursPrets?: number;        // total maximal de prêts non remboursés par membre
  exigerCotisationsAJour?: boolean;    // être à jour pour un prêt ou une prestation
  penaliteRetard?: number;
  debutExercice?: string;
  prefixRecu?: string;
  motifAnnulationObligatoire?: boolean;
}

export interface Notifications {
  canalEmailEnabled?: boolean;          // interrupteur général des emails
  rappelsCotisationsEnabled?: boolean;  // rappel mensuel des cotisations impayées
  rappelsEcheancesEnabled?: boolean;    // rappels d'échéances de remboursement
}

export interface Exports {
  footer?: string;
}

export interface SettingsMeta {
  updatedAt?: string;
  updatedBy?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/settings`;

  get(): Observable<SettingsDTO> {
    return this.http.get<SettingsDTO>(this.BASE_PATH);
  }

  update(settings: SettingsDTO): Observable<SettingsDTO> {
    return this.http.put<SettingsDTO>(this.BASE_PATH, settings);
  }

  reset(): Observable<SettingsDTO> {
    return this.http.post<SettingsDTO>(`${this.BASE_PATH}/reset`, {});
  }

  getMeta(): Observable<SettingsMeta> {
    return this.http.get<SettingsMeta>(`${this.BASE_PATH}/meta`);
  }
}
















