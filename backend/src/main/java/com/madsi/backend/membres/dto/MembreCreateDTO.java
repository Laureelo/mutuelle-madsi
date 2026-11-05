package com.madsi.backend.membres.dto;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.RoleMembre;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MembreCreateDTO(
        @NotBlank @Size(max=30) String username,
        @NotBlank @Size(min=6) String password,
        @NotBlank @Size(max=50) String firstName,
        @NotBlank @Size(max=50) String lastName,
        @NotBlank @Email String email,
        @Size(max=20) String phone,
        @Size(max=50) String matriculeFonctionPublique, // Matricule de la fonction publique (saisi lors de l'inscription)
        @Size(max=80) String fonction,
        RoleMembre role,
        Enums.EtatCompte etatCompte
) {}

