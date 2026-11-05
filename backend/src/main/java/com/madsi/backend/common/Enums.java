package com.madsi.backend.common;

public class Enums {

    public enum CotiStatut { EN_ATTENTE, PAYE, PARTIEL, EN_RETARD, REJETE }
    public enum SensOp { ENTREE, SORTIE }
    public enum TypeOperation { COTISATION, APPORT, RECETTE, DEPENSE, REMBOURSEMENT_PRET }
    public enum ModePaiement { ESPECES, MOBILE_MONEY }
    public enum OpStatut { ENREGISTREE, ANNULEE, EN_ATTENTE_CONFIRMATION }
    public enum ObjetRecu { ADHESION, COTISATION, APPORT, RECETTE, DEPENSE, REMBOURSEMENT_PRET }
    public enum Canal { PUSH, EMAIL, WHATSAPP }
    public enum NotifType { RAPPEL, ALERTE, INFO }
    public enum NotifEtat { ENVOYE, ECHEC, LU }
    public enum TopicType { COTISATION, PRET, ECHEANCE, MANIFESTATION, AUTRE }
    public enum PretStatut { DEMANDE, APPROUVE, REFUSE, EN_COURS, CLOTURE }
    public enum PeriodeUnite { JOUR, SEMAINE, MOIS }
    public enum EchStatut { EN_ATTENTE, PAYE, PARTIEL, RETARD }
    public enum RemStatut { EN_ATTENTE, ENREGISTRE, REJETE, ANNULE }

    public enum EtatCompte { VISITEUR, EN_ATTENTE, VALIDE_PAR_TRESORERIE, ACTIF, INACTIF }

    public enum NotifStyle { CLASSIC,FUNNY  }

// --- Manifestations / activités ---
    public enum ManifStatut { EN_ATTENTE, PLANIFIEE, REALISEE, ANNULEE }

    public enum TypeActiviteCat { MARIAGE, NAISSANCE, MALADIE, RETRAITE,DECES,SPORT, CULTURE, AUTRE }

// --- Rapports ---
    public enum RapportType { FINANCIER, STATISTIQUE, METIER, FIN_DE_MANDAT }

    public enum HistoType { ADHESION, COTISATION, PRET, MANIFESTATION, NOTIFICATION, PARAMETRE, SYSTEME }

}
