package com.madsi.backend.membres.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.RoleMembre;

/** Représentation publique d'un membre (réponses API). */
public record MembreDTO(
        Long id,
        String matricule, // Matricule MADSI (généré automatiquement)
        String matriculeFonctionPublique, // Matricule de la fonction publique
        String username,
        String email,
        String phone,
        String firstName,
        String lastName,
        String fonction,
        RoleMembre role,
        Enums.EtatCompte etatCompte,
        LocalDate dateAdhesion,
        OffsetDateTime dateRegistered,
        OffsetDateTime dateValidated,
        Long validePar,
        OffsetDateTime dateValidatedTresorerie,
        Long valideParTresorerie,
        String photoUrl,
        Boolean notificationsEmail   // le membre accepte-t-il les emails de rappel ?
) {}
