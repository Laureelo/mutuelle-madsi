package com.madsi.backend.settings;

import com.madsi.backend.security.AccessGuard;
import com.madsi.backend.settings.dto.SettingsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Paramètres de l'organisation. Lecture : tout compte connecté.
 * Modification et remise à zéro : administrateur (voir SecurityConfig).
 * L'éditeur est déduit du jeton (l'ancien en-tête X-Admin-Id est ignoré).
 */
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService service;
    private final AccessGuard guard;

    /** GET /api/settings */
    @GetMapping
    public SettingsDTO get() {
        return service.get();
    }

    /**
     * GET /api/settings/public : montants et nom de l'organisation, SANS connexion
     * (la page d'inscription affiche le droit d'adhésion).
     */
    @GetMapping("/public")
    public Map<String, Object> publicInfo() {
        return service.publicInfo();
    }

    /** PUT /api/settings */
    @PutMapping
    public SettingsDTO update(@RequestBody SettingsDTO in) {
        return service.update(in, guard.currentMembreId());
    }

    @GetMapping("/meta")
    public Map<String,Object> meta(AppSettingsRepository repo){
        var opt = repo.findById(1L);
        Map<String,Object> out = new LinkedHashMap<>();
        if (opt.isEmpty()) return out;
        var a = opt.get();
        out.put("updatedAt", a.getUpdatedAt() != null ? a.getUpdatedAt().toString() : "");
        out.put("updatedBy", a.getUpdatedBy());
        return out;
    }

    @PostMapping("/reset")
    public SettingsDTO reset(){
        return service.resetToDefaults(guard.currentMembreId());
    }
}
