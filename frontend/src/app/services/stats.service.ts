import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MonthlyCashflow {
  month: number;
  entrees: number;
  sorties: number;
  solde?: number | null;   // caisse en fin de mois (absent pour les mois à venir)
}

export interface LabelValue {
  label: string;
  value: number;
}

export interface TopItem {
  label: string;
  amount: number;
}

export interface MonthlyCount {
  month: number;
  count: number;
}

export interface CotisationMois {
  month: number;
  payes: number;
  attendus: number;
  montantPaye: number;
  montantAttendu: number;
  taux: number | null;
}

export interface RetardRemboursement {
  membreId: number;
  nom: string;
  echeances: number;
  montant: number;
  joursMax: number;
}

export interface TreasuryStats {
  year: number;
  soldeCaisse: number;
  soldeDebutAnnee: number;
  soldeFinAnnee: number;
  totalEntrees: number;
  totalSorties: number;
  totalCotisations: number;
  totalAdhesions: number;
  totalRemboursements: number;
  totalPretsVerses: number;
  totalPrestations: number;
  pretsEnCours: number;
  encoursPrets: number;
  pretsEnAttente: number;
  echeancesAujourdHui: number;
  echeancesEnRetard: number;
  montantEnRetard: number;
  echeancesProchains30Jours: number;
  depensesEnAttente: number;
  montantDepensesEnAttente: number;
  monthlyCashflow: MonthlyCashflow[];
  entreesParOrigine: LabelValue[];
  sortiesParDestination: LabelValue[];
  pretsParStatut: LabelValue[];
  repartitionOperations: LabelValue[];
  topDepenses: TopItem[];
  cotisationsParMois: CotisationMois[];
  retardsRemboursement: RetardRemboursement[];
}

export interface MembershipStats {
  year: number;
  totalMembres: number;
  membresActifs: number;
  membresEnAttente: number;
  membresInactifs: number;
  visiteurs: number;
  membresAJour: number;
  membresEnRetard: number;
  tauxAJour: number | null;
  montantImpaye: number;
  avertissementsPossibles: number;
  manifestationsEnAttente: number;
  manifestationsPlanifiees: number;
  manifestationsRealisees: number;
  manifestationsAnnulees: number;
  depensesActivites: number;
  inscriptionsParMois: MonthlyCount[];
  adhesionsParMois: MonthlyCount[];
  repartitionEtat: LabelValue[];
  repartitionRoles: LabelValue[];
  repartitionRetards: LabelValue[];
  repartitionManifestations: LabelValue[];
  depensesParCategorie: LabelValue[];
}

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/stats`;

  // Subject pour notifier le rafraîchissement des stats
  private refreshStatsSubject = new Subject<void>();
  public refreshStats$ = this.refreshStatsSubject.asObservable();

  /** Notifie tous les composants abonnés qu'ils doivent rafraîchir leurs statistiques. */
  notifyRefresh(): void {
    this.refreshStatsSubject.next();
  }

  getTreasuryStats(year?: number): Observable<TreasuryStats> {
    return this.http.get<TreasuryStats>(`${this.BASE_PATH}/treasury`, { params: this.params(year) });
  }

  getMembershipStats(year?: number): Observable<MembershipStats> {
    return this.http.get<MembershipStats>(`${this.BASE_PATH}/membership`, { params: this.params(year) });
  }

  private params(year?: number): HttpParams {
    return year ? new HttpParams().set('year', year.toString()) : new HttpParams();
  }
}
