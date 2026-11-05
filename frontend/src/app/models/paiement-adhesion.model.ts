import { ModePaiement } from './cotisation.model';

/**
 * Modèle pour les paiements d'adhésion (workflow en 2 étapes)
 */
export interface PaiementAdhesion {
  id: number;
  membreId: number;
  montant: number;
  modePaiement: ModePaiement;
  datePaiement: string;
  reference?: string;
  photoPreuve?: string;
  statut: StatutPaiementAdhesion;
  enregistreParTresorier?: number;
  dateEnregistrement: string;
  valideParAdmin?: number;
  dateValidationAdmin?: string;
  remarques?: string;
  operationId?: number;
}

export enum StatutPaiementAdhesion {
  EN_ATTENTE = 'EN_ATTENTE',    // Enregistré par trésorier
  VALIDE = 'VALIDE',            // Validé par admin métier
  REJETE = 'REJETE'             // Rejeté par admin métier
}

/**
 * DTO pour enregistrer un paiement d'adhésion (trésorier)
 */
export interface EnregistrerPaiementDTO {
  membreId: number;
  modePaiement: ModePaiement;
  datePaiement: string;
  reference?: string;
  photoPreuve?: string;
  remarques?: string;
}

/**
 * DTO pour rejeter un paiement
 */
export interface RejeterPaiementDTO {
  motif: string;
}

/**
 * Paiement d'adhésion avec informations du membre (pour affichage)
 */
export interface PaiementAdhesionAvecMembre extends PaiementAdhesion {
  membreNom?: string;
  membrePrenom?: string;
  membreEmail?: string;
}
