export enum SensOp {
  ENTREE = 'ENTREE',
  SORTIE = 'SORTIE'
}

export enum TypeOperation {
  COTISATION = 'COTISATION',
  APPORT = 'APPORT',
  RECETTE = 'RECETTE',
  DEPENSE = 'DEPENSE',
  REMBOURSEMENT_PRET = 'REMBOURSEMENT_PRET'
}

export enum CategorieOperation {
  ADHESION = 'ADHESION',
  COTISATION = 'COTISATION',
  PRET = 'PRET',
  REMBOURSEMENT = 'REMBOURSEMENT',
  MANIFESTATION = 'MANIFESTATION',
  CHARGE = 'CHARGE',
  AUTRE = 'AUTRE'
}

export interface Operation {
  id: number;
  dateOp: string;  // Correspond à dateOp du backend (OffsetDateTime)
  montant: number;
  sens: SensOp;  // ENTREE ou SORTIE
  typeOp: TypeOperation;  // COTISATION, APPORT, RECETTE, DEPENSE, REMBOURSEMENT_PRET
  modePaiement?: string;  // ESPECES, MOBILE_MONEY
  reference?: string;
  statut?: string;  // ENREGISTREE, ANNULEE
  membreId?: number;
  objetType?: string;  // "cotisation", "pret", "manifestation", etc.
  objetId?: number;
  recuId?: number;
  membreNom?: string;  // Nom du membre (depuis le backend)
  membrePrenom?: string;  // Prénom du membre (depuis le backend)
  photoPreuve?: string;  // Preuve de paiement (Base64 ou URL)
  aPreuve?: boolean;  // une preuve est jointe (l'image se charge à la demande)

  // Champs calculés côté frontend pour l'affichage
  description?: string;
}

export interface OperationCreate {
  type: TypeOperation;
  categorie: CategorieOperation;
  montant: number;
  description: string;
  dateOperation: string;
  referencePaiement?: string;
  membreId?: number;
  pretId?: number;
  cotisationId?: number;
  manifestationId?: number;
}

export interface OperationFilter {
  q?: string;  // Recherche textuelle
  sens?: SensOp;  // ENTREE ou SORTIE
  typeOp?: TypeOperation;  // Type d'opération
  mode?: string;  // Mode de paiement
  statut?: string;  // Statut
  dateFrom?: string;  // Date début (YYYY-MM-DD)
  dateTo?: string;  // Date fin (YYYY-MM-DD)
  page?: number;
  size?: number;
}

export interface SoldeResponse {
  soldeTotal: number;
  totalEntrees: number;
  totalSorties: number;
  derniereMiseAJour: string;
  date?: string;
}
