export enum StatutCotisation {
  EN_ATTENTE = 'EN_ATTENTE',
  PAYE = 'PAYE',
  PARTIEL = 'PARTIEL',
  EN_RETARD = 'EN_RETARD',
  REJETE = 'REJETE'
}

export enum ModePaiement {
  ESPECES = 'ESPECES',
  MOBILE_MONEY = 'MOBILE_MONEY'
}

export interface Cotisation {
  id: number;
  membreId: number;
  membreNom?: string;
  membreEmail?: string;
  montant: number;
  periodes: string;          // CSV des périodes: "2026-01,2026-02,2026-03"
  periode?: string;          // Pour rétrocompatibilité (première période)
  nombreMois: number;         // Nombre de mois payés
  datePaiement: string;
  modePaiement?: ModePaiement;
  statut: StatutCotisation;
  reference?: string;
  remarque?: string;
  motifRejet?: string;        // Motif de rejet si statut = REJETE
  photoPreuve?: string;       // Preuve de paiement (Base64 ou URL)
  aPreuve?: boolean;          // une preuve est jointe (l'image se charge à la demande)
  operationId?: number;
  numeroRecu?: string;
  valideParTresorier?: number;
  dateValidation?: string;
}

export interface CotisationCreate {
  membreId: number;
  montant: number;
  periode: string;
  datePaiement: string;
  modePaiement: ModePaiement;
  reference?: string;
  statut?: StatutCotisation;
}

export interface CotisationUpdate {
  montant?: number;
  periode?: string;
  datePaiement?: string;
  modePaiement?: ModePaiement;
  reference?: string;
  statut?: StatutCotisation;
}

export interface CotisationFilter {
  membreId?: number;
  periode?: string;
  statut?: StatutCotisation;
  modePaiement?: ModePaiement;
  dateDebut?: string;
  dateFin?: string;
  page?: number;
  size?: number;
}

// Nouveau: Déclaration de cotisation par un membre
export interface DeclarerCotisationInput {
  membreId: number;
  moisDebut: string;          // Format: "2026-01"
  nombreMois: number;          // Nombre de mois à payer (1-12)
  modePaiement: ModePaiement;
  reference?: string;
  remarque?: string;
  photoPreuve?: string;        // Preuve de paiement (Base64)
}

// Stats pour les cotisations
export interface CotisationStats {
  total: number;
  enAttente: number;
  payees: number;
  enRetard: number;
  montantTotal: number;
}
