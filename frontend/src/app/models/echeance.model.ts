export enum EchStatut {
  EN_ATTENTE = 'EN_ATTENTE',
  PAYE = 'PAYE',
  PARTIEL = 'PARTIEL',
  RETARD = 'RETARD'
}

export interface Echeance {
  id: number;
  pretId: number;
  numero: number;
  dateEcheance: string;
  montantDu: number;
  statut: EchStatut;
}

export interface RemboursementPret {
  id: number;
  echeanceId: number;
  datePaiement: string;
  modePaiement: 'ESPECES' | 'MOBILE_MONEY';
  statut: 'EN_ATTENTE' | 'ENREGISTRE' | 'REJETE' | 'ANNULE';
  operationId?: number;
  montant: number;
  reference?: string;
  preuveUrl?: string;
}

export interface RemboursementCreate {
  echeanceId: number;
  montant: number;
  modePaiement: 'ESPECES' | 'MOBILE_MONEY';
  reference?: string;
}

export interface RemboursementAck {
  remboursementId: number;
  operationId: number;
  recuId: number;
  recuNumero: string;
  recuUrl: string;
}
