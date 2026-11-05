export enum ManifStatut {
  EN_ATTENTE = 'EN_ATTENTE',
  PLANIFIEE = 'PLANIFIEE',
  REALISEE = 'REALISEE',
  ANNULEE = 'ANNULEE'
}

export type StatutManifestation = ManifStatut;

export interface Manifestation {
  id: number;
  membreId: number;
  typeActiviteId: number;
  libelle: string;  // Nom de la manifestation
  date: string;  // Date de la manifestation (LocalDate)
  lieu?: string;
  description?: string;
  statut: ManifStatut;
  montantDepense: number;  // Montant des dépenses calculé depuis les opérations
  montantPrevu?: number;
  montantReel?: number;
  materiaux?: string;
  remarques?: string;
  dateCloture?: string;
  cloturePar?: number;
  moisImpayesMembre?: number | null; // mois de cotisation impayés du bénéficiaire (demandes en attente)
  
  // Champs calculés/ajoutés côté frontend pour l'affichage
  membreNom?: string;
  membrePrenom?: string;
  typeActiviteNom?: string;
}

export interface ManifestationCreate {
  membreId: number;
  typeActiviteId: number;
  libelle: string;
  date: string;  // Format YYYY-MM-DD
  lieu?: string;
  description?: string;
  statut?: ManifStatut;  // Optionnel, défaut PLANIFIEE
}

export interface ManifestationUpdate {
  nom?: string;
  description?: string;
  dateDebut?: string;
  dateFin?: string;
  lieu?: string;
  budgetPrevu?: number;
  statut?: ManifStatut;
  commentaire?: string;
}

export interface ManifestationFilter {
  q?: string;  // Recherche textuelle
  statut?: string;  // Statut comme string
  from?: string;  // Date début (YYYY-MM-DD)
  to?: string;  // Date fin (YYYY-MM-DD)
  page?: number;
  size?: number;
}

export interface Participation {
  id: number;
  manifestationId: number;
  manifestationNom?: string;
  membreId: number;
  membreNom?: string;
  membrePrenom?: string;
  contribution: number;
  dateParticipation: string;
  commentaire?: string;
  createdAt?: string;
}

export interface ParticipationCreate {
  manifestationId: number;
  membreId: number;
  contribution: number;
  dateParticipation: string;
  commentaire?: string;
}
