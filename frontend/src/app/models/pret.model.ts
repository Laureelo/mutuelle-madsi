export enum StatutPret {
  DEMANDE = 'DEMANDE',      // Correspond à EN_ATTENTE côté frontend
  APPROUVE = 'APPROUVE',
  REFUSE = 'REFUSE',        // Correspond à REJETE côté frontend
  EN_COURS = 'EN_COURS',
  CLOTURE = 'CLOTURE'
}

export type PeriodeUnite = 'JOUR' | 'SEMAINE' | 'MOIS';

export interface Pret {
  id: number;
  membreId: number;
  membreNom?: string;
  membrePrenom?: string;
  montant: number;
  duree: number;
  periodeUnite?: PeriodeUnite;
  dateDemande?: string;
  dateValidation?: string;
  dateDecaissement?: string;
  statut: StatutPret;
  montantRembourse: number;
  montantRestant: number;
  motif?: string;             // Motif de la demande de prêt (facultatif)
  motifRejet?: string;        // Motif de rejet si statut = REFUSE
  photoPreuve?: string;        // Base64 ou URL de la preuve de paiement
  aPreuve?: boolean;  // une preuve est jointe (l'image se charge à la demande)
  confirmationRequise?: boolean; // montant au-dessus du seuil : le président (admin) doit confirmer avant la validation
  confirme?: boolean;            // confirmé par le président (admin)
  moisImpayesMembre?: number | null; // mois de cotisation impayés du demandeur (information)
}

export interface PretCreate {
  membreId: number;
  montant: number;
  dureeMois: number;
  periodeUnite?: PeriodeUnite;
  motif?: string;              // Motif de la demande (facultatif)
}

export interface PretUpdate {
  montant?: number;
  tauxInteret?: number;
  duree?: number;
  statut?: StatutPret;
  commentaire?: string;
}

export interface PretFilter {
  membreId?: number;
  statut?: StatutPret;
  montantMin?: number;
  montantMax?: number;
  dateDebut?: string;
  dateFin?: string;
  page?: number;
  size?: number;
}

export interface Remboursement {
  id: number;
  pretId: number;
  montant: number;
  dateRemboursement: string;
  referencePaiement?: string;
  commentaire?: string;
  createdAt?: string;
}

export interface RemboursementCreate {
  pretId: number;
  montant: number;
  dateRemboursement: string;
  referencePaiement?: string;
  commentaire?: string;
}
