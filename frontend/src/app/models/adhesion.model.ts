import { ModePaiement } from './cotisation.model';

export interface Adhesion {
  id: number;
  membreId: number;
  montant: number;
  datePaiement: string;
  modePaiement: ModePaiement;
  reference?: string;
  remarque?: string;
  photoPreuve?: string;
  aPreuve?: boolean;          // une preuve est jointe (l'image se charge à la demande)
  statut: StatutAdhesion;
  valideParTresorerie?: number;
  dateValidation?: string;
  motifRejet?: string;
  operationId?: number;
  dateCreation: string;
}

export enum StatutAdhesion {
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDE = 'VALIDE',
  REJETE = 'REJETE'
}

export interface AdhesionCreate {
  modePaiement: ModePaiement;
  reference?: string;
  remarque?: string;
  photoPreuve?: string;
}

export interface AdhesionStats {
  total: number;
  validees: number;
  enAttente: number;
  rejetees: number;
}
