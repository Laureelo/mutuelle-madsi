package com.madsi.backend.admin;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Santé du système : réservé à l'administrateur (voir SecurityConfig). */
@RestController
@RequestMapping("/api/admin/sante")
public class SanteController {

    private final SanteService service;

    public SanteController(SanteService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> etat() {
        return service.etat();
    }
}
