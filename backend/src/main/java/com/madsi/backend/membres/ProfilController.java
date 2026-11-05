package com.madsi.backend.membres;

import com.madsi.backend.membres.dto.MembreDTO;
import com.madsi.backend.membres.dto.ProfilUpdateDTO;
import com.madsi.backend.security.AccessGuard;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Profil du compte connecté. L'identité est TOUJOURS déduite du jeton.
 * Les erreurs (validation, mot de passe incorrect...) sont traduites par GlobalExceptionHandler.
 */
@RestController
@RequestMapping("/api/profil")
@RequiredArgsConstructor
public class ProfilController {

    private final MembreService service;
    private final AccessGuard guard;

    @GetMapping("/mon-profil")
    public MembreDTO getMonProfil() {
        return service.get(guard.currentMembreId());
    }

    /** Modification des champs personnels uniquement (jamais le rôle ni l'état du compte). */
    @PutMapping("/mon-profil")
    public MembreDTO updateMonProfil(@Valid @RequestBody ProfilUpdateDTO in) {
        return service.updateProfil(guard.currentMembreId(), in);
    }

    @PostMapping("/changer-mot-de-passe")
    public Map<String, String> changerMotDePasse(@RequestBody Map<String, String> request) {
        String oldPassword = request.get("oldPassword");
        String newPassword = request.get("newPassword");
        service.changePassword(guard.currentMembreId(), oldPassword, newPassword);
        return Map.of("message", "Mot de passe modifié avec succès");
    }
}
