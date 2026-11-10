package com.madsi.backend.settings;


import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.madsi.backend.settings.dto.SettingsDTO;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class SettingsService {

    /** Montants fixés par le règlement intérieur de la MADSI (art. 9 et 10). */
    public static final int MONTANT_COTISATION_DEFAUT = 1000;
    public static final int MONTANT_ADHESION_DEFAUT = 2000;
    public static final int SEUIL_CONFIRMATION_DEFAUT = 50_000;
    public static final int PLAFOND_ENCOURS_DEFAUT = 50_000;

    private final AppSettingsRepository repo;
    private final ObjectMapper objectMapper; // utilise celui de Spring (déjà configuré)

    // ---------- Accesseurs utilisés par les autres services (source unique des montants) ----------

    /** Cotisation mensuelle en FCFA. */
    public java.math.BigDecimal montantCotisation() {
        var f = get().getFinance();
        int v = (f != null && f.getMontantCotisation() != null && f.getMontantCotisation() > 0)
                ? f.getMontantCotisation() : MONTANT_COTISATION_DEFAUT;
        return java.math.BigDecimal.valueOf(v).setScale(2);
    }

    /** Droit d'adhésion en FCFA. */
    public java.math.BigDecimal montantAdhesion() {
        var f = get().getFinance();
        int v = (f != null && f.getMontantAdhesion() != null && f.getMontantAdhesion() > 0)
                ? f.getMontantAdhesion() : MONTANT_ADHESION_DEFAUT;
        return java.math.BigDecimal.valueOf(v).setScale(2);
    }

    /** Montant au-delà duquel une dépense ou un prêt doit être confirmé par le président (administrateur). */
    public java.math.BigDecimal seuilConfirmation() {
        var f = get().getFinance();
        int v = (f != null && f.getSeuilConfirmationDepense() != null && f.getSeuilConfirmationDepense() > 0)
                ? f.getSeuilConfirmationDepense() : SEUIL_CONFIRMATION_DEFAUT;
        return java.math.BigDecimal.valueOf(v).setScale(2);
    }

    /** Total maximal de prêts non remboursés pour un même membre. */
    public java.math.BigDecimal plafondEncoursPrets() {
        var f = get().getFinance();
        int v = (f != null && f.getPlafondEncoursPrets() != null && f.getPlafondEncoursPrets() > 0)
                ? f.getPlafondEncoursPrets() : PLAFOND_ENCOURS_DEFAUT;
        return java.math.BigDecimal.valueOf(v).setScale(2);
    }

    /**
     * Faut-il être à jour de ses cotisations pour obtenir un prêt ou une prestation (règlement art. 11 et 18) ?
     * DÉSACTIVÉ par défaut : c'est à chaque mutuelle de décider. Désactivée, la règle ne bloque personne,
     * mais les mois impayés restent affichés au membre, au trésorier et au président.
     */
    public boolean exigerCotisationsAJour() {
        var f = get().getFinance();
        return f != null && Boolean.TRUE.equals(f.getExigerCotisationsAJour());
    }

    /** Rappel mensuel des cotisations impayées (actif par défaut). */
    public boolean rappelsCotisationsActifs() {
        var n = get().getNotifications();
        return n == null || n.getRappelsCotisationsEnabled() == null || n.getRappelsCotisationsEnabled();
    }

    /** Rappels d'échéances de remboursement (actifs par défaut). */
    public boolean rappelsEcheancesActifs() {
        var n = get().getNotifications();
        return n == null || n.getRappelsEcheancesEnabled() == null || n.getRappelsEcheancesEnabled();
    }

    /** Préfixe des numéros de reçu (ex. « MADSI- »). */
    public String prefixRecu() {
        var f = get().getFinance();
        return (f != null && f.getPrefixRecu() != null && !f.getPrefixRecu().isBlank()) ? f.getPrefixRecu().trim() : "MADSI-";
    }

    /** Informations publiques (page d'inscription, avant connexion). */
    public java.util.Map<String, Object> publicInfo() {
        var s = get();
        var org = s.getOrganisation();
        var out = new java.util.LinkedHashMap<String, Object>();
        out.put("nom", org != null && org.getNom() != null ? org.getNom() : "MADSI");
        out.put("devise", org != null && org.getDevise() != null ? org.getDevise() : "FCFA");
        out.put("montantCotisation", montantCotisation().intValue());
        out.put("montantAdhesion", montantAdhesion().intValue());
        return out;
    }

    /**
     * Corrige l'ancien défaut erroné (5000 FCFA) tant qu'aucun administrateur n'a modifié les paramètres
     * (updatedBy vide) : le règlement intérieur fixe la cotisation à 1000 FCFA.
     */
    public void corrigerAncienDefaut() {
        var opt = repo.findById(1L);
        if (opt.isEmpty() || opt.get().getUpdatedBy() != null) return;
        var dto = get();
        var f = dto.getFinance();
        if (f != null && Integer.valueOf(5000).equals(f.getMontantCotisation())) {
            f.setMontantCotisation(MONTANT_COTISATION_DEFAUT);
            if (f.getMontantAdhesion() == null) f.setMontantAdhesion(MONTANT_ADHESION_DEFAUT);
            saveRaw(dto, null);
        }
    }

    /** Lecture (crée avec défauts si inexistant). */
    public SettingsDTO get() {
        var opt = repo.findById(1L);
        if (opt.isEmpty()) {
            var def = defaults();
            saveRaw(def, null);
            return def;
        }
        try {
            return fromJson(opt.get().getContentJson());
        } catch (RuntimeException e) {
            // Si le JSON est invalide ou ne correspond pas à la structure attendue,
            // réinitialiser avec les valeurs par défaut
            var def = defaults();
            saveRaw(def, null);
            return def;
        }
    }
    public SettingsDTO resetToDefaults(Long updatedBy){
        var def = defaults();
        saveRaw(def, updatedBy);
        return def;
    }

    /** Mise à jour (remplace l'objet entier par le DTO fourni). */
    public SettingsDTO update(SettingsDTO in, Long updatedBy) {
        saveRaw(in, updatedBy);
        return get();
    }

    // -------------------- internes --------------------

    private void saveRaw(SettingsDTO dto, Long updatedBy) {
        String json = toJson(dto);
        var entity = repo.findById(1L).orElseGet(() -> {
            var e = new AppSettings();
            e.setId(1L);
            return e;
        });
        entity.setContentJson(json);
        entity.setUpdatedBy(updatedBy);
        repo.save(entity); // updatedAt géré via @PreUpdate/@PrePersist
    }

    private String toJson(SettingsDTO dto) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(dto);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Erreur sérialisation settings", e);
        }
    }

    private SettingsDTO fromJson(String json) {
        try {
            if (json == null || json.trim().isEmpty()) {
                return defaults();
            }
            return objectMapper.readValue(json, SettingsDTO.class);
        } catch (JsonProcessingException e) {
            // Si le JSON ne peut pas être désérialisé, retourner les valeurs par défaut
            // et logger l'erreur pour debug
            log.warn("Réglages illisibles, valeurs par défaut utilisées : {}", e.getMessage());
            return defaults();
        }
    }

    /** Valeurs par défaut à la première exécution. */
    private SettingsDTO defaults() {
        return SettingsDTO.builder()
                .organisation(SettingsDTO.Organisation.builder()
                        .nom("MADSI")
                        .emailContact("contact@madsi.local")
                        .phoneContact("+226 72 00 00 00")
                        .adresse("Koulouba, Ouagadougou")
                        .logoUrl(null)
                        .devise("FCFA")
                        .build())
                .finance(SettingsDTO.Finance.builder()
                        .montantCotisation(MONTANT_COTISATION_DEFAUT)
                        .montantAdhesion(MONTANT_ADHESION_DEFAUT)
                        .seuilConfirmationDepense(SEUIL_CONFIRMATION_DEFAUT)
                        .plafondEncoursPrets(PLAFOND_ENCOURS_DEFAUT)
                        .exigerCotisationsAJour(Boolean.FALSE)
                        .penaliteRetard(0)
                        .debutExercice("2025-01-01")
                        .prefixRecu("MADSI-")
                        .motifAnnulationObligatoire(Boolean.TRUE)
                        .build())
                .notifications(SettingsDTO.Notifications.builder()
                        .canalEmailEnabled(Boolean.TRUE)
                        .rappelsCotisationsEnabled(Boolean.TRUE)
                        .rappelsEcheancesEnabled(Boolean.TRUE)
                        .build())
                .exports(SettingsDTO.Exports.builder()
                        .footer("MADSI - Généré le {{date}}")
                        .build())
                .build();
    }
}