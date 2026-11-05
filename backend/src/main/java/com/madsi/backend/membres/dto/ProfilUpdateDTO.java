package com.madsi.backend.membres.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Champs qu'un membre peut modifier lui-même sur son profil.
 *
 * Volontairement ABSENTS : rôle, état du compte et nom d'utilisateur. Ils ne peuvent être
 * changés que par un administrateur, sinon n'importe quel membre pourrait se donner le rôle ADMIN.
 * Un champ non renseigné (null) reste inchangé.
 */
public record ProfilUpdateDTO(
        @Size(max = 50) String firstName,
        @Size(max = 50) String lastName,
        @Email @Size(max = 120) String email,
        @Size(max = 20) String phone,
        @Size(max = 50) String matriculeFonctionPublique,
        @Size(max = 80) String fonction,
        String photoUrl,
        Boolean notificationsEmail   // accepter ou refuser les emails de rappel
) {}
