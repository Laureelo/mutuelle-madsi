package com.madsi.backend.membres;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import com.madsi.backend.common.Enums;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entité alignée sur ta table `membres` (PostgreSQL).
 * Adapte les noms de colonnes si les tiens diffèrent.
 */
@Entity
@Table(name = "membres")
@Getter @Setter @NoArgsConstructor
public class Membre {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String matricule; // Matricule MADSI (généré automatiquement)

    @Column(name = "matricule_fonction_publique")
    private String matriculeFonctionPublique; // Matricule de la fonction publique (saisi par le visiteur)

    @Column(unique = true)
    private String username;

    @Column(name = "password")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String password;


    @Column(nullable = false, unique = true)
    private String email;

    private String phone;

    /** Le membre accepte-t-il les emails de rappel ? (vide = oui) Les messages importants lui parviennent toujours. */
    @Column(name = "notifications_email")
    private Boolean notificationsEmail;
    @Column(name = "first_name") private String firstName;
    @Column(name = "last_name")  private String lastName;

    private String fonction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoleMembre role = RoleMembre.MEMBRE;

    @Enumerated(EnumType.STRING)
    @Column(name = "etat_compte", nullable = false)
    private Enums.EtatCompte etatCompte = Enums.EtatCompte.EN_ATTENTE;

    @Column(name = "date_adhesion")
    private LocalDate dateAdhesion;

    @Column(name = "date_registered")
    private OffsetDateTime dateRegistered = OffsetDateTime.now();

    @Column(name = "date_validated")
    private OffsetDateTime dateValidated;

    @Column(name = "valide_par")
    private Long validePar; // id du validateur (admin métier)

    @Column(name = "valide_par_tresorerie")
    private Long valideParTresorerie; // id du trésorier qui a validé

    @Column(name = "date_validated_tresorerie")
    private OffsetDateTime dateValidatedTresorerie; // date de validation par trésorerie

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl; // petite image (vignette) encodée, ou adresse
}
