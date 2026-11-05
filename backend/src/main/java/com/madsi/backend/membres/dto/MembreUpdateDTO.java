// src/main/java/com/madsi/backend/membres/dto/MembreUpdateDTO.java
package com.madsi.backend.membres.dto;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.RoleMembre;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MembreUpdateDTO(
        @Size(max=30) String username,
        @Email String email,
        @Size(max=20) String phone,
        @NotBlank @Size(max=50) String firstName,
        @NotBlank @Size(max=50) String lastName,
        @Size(max=50) String matriculeFonctionPublique, // Matricule de la fonction publique (modifiable par admin)
        @Size(max=80) String fonction,
        RoleMembre role,
        Enums.EtatCompte etatCompte,
        @Size(max=250) String photoUrl
) {}