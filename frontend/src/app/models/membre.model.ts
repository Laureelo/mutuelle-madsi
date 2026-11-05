export enum RoleMembre {
  VISITEUR = 'VISITEUR',  // Visiteur non encore validé (avant activation par admin)
  MEMBRE = 'MEMBRE',      // Membre actif validé
  TRESORIER = 'TRESORIER', // Trésorier
  COMMISSAIRE = 'COMMISSAIRE', // Commissaire aux comptes (lecture seule)
  ADMIN = 'ADMIN'         // Administrateur
}

export enum EtatCompte {
  VISITEUR = 'VISITEUR',
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDE_PAR_TRESORERIE = 'VALIDE_PAR_TRESORERIE',
  ACTIF = 'ACTIF',
  INACTIF = 'INACTIF'
}

export interface Membre {
  id: number;
  matricule?: string; // Matricule MADSI (généré automatiquement)
  matriculeFonctionPublique?: string; // Matricule de la fonction publique (saisi par le visiteur)
  username: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fonction?: string;
  role: RoleMembre;
  etatCompte: EtatCompte;
  dateAdhesion?: string;
  dateRegistered: string;
  dateValidated?: string;
  validePar?: number;
  dateValidatedTresorerie?: string;
  valideParTresorerie?: number;
  photoUrl?: string;
  notificationsEmail?: boolean;   // accepte les emails de rappel
}

export interface MembreCreate {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  matriculeFonctionPublique?: string;
  fonction?: string;
  role?: RoleMembre;
  etatCompte?: EtatCompte;
}

export interface MembreUpdate {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  matriculeFonctionPublique?: string;
  fonction?: string;
  role?: RoleMembre;
  etatCompte?: EtatCompte;
  photoUrl?: string;
  notificationsEmail?: boolean;   // accepte les emails de rappel
}

export interface MembreFilter {
  search?: string;
  etatCompte?: EtatCompte;
  role?: RoleMembre;
  page?: number;
  size?: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
