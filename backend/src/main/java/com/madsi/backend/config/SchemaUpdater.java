package com.madsi.backend.config;

import com.madsi.backend.membres.RoleMembre;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Mises à niveau de schéma que Hibernate (ddl-auto=update) ne sait pas faire seul.
 *
 * Hibernate crée une contrainte CHECK sur la colonne « role » avec la liste des rôles connus à ce
 * moment-là, puis ne la modifie plus. Sur une base créée avant l'ajout des rôles BUREAU et
 * COMMISSAIRE, ces rôles seraient donc refusés. Cette mise à niveau (idempotente) recrée la
 * contrainte avec la liste actuelle des rôles.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class SchemaUpdater implements CommandLineRunner {

    private final JdbcTemplate jdbc;
    private final com.madsi.backend.settings.SettingsService settingsService;

    @Override
    public void run(String... args) {
        // Paramètres : l'ancien défaut erroné (cotisation 5000 FCFA) est ramené à 1000 FCFA (règlement, art. 10)
        try {
            settingsService.corrigerAncienDefaut();
        } catch (Exception e) {
            log.warn("Vérification des paramètres impossible : {}", e.getMessage());
        }
        try {
            // Le rôle BUREAU n'existe plus (ses droits sont ceux de l'administrateur et des trésoriers) : ces comptes deviennent des membres
            jdbc.update("UPDATE membres SET role = 'MEMBRE' WHERE role = 'BUREAU'");
            String roles = Arrays.stream(RoleMembre.values())
                    .map(r -> "'" + r.name() + "'")
                    .collect(Collectors.joining(", "));
            jdbc.execute("ALTER TABLE membres DROP CONSTRAINT IF EXISTS membres_role_check");
            jdbc.execute("ALTER TABLE membres ADD CONSTRAINT membres_role_check CHECK (role IN (" + roles + "))");
            log.info("Contrainte des rôles à jour : {}", roles);
            // Opérations : nouvel état EN_ATTENTE_CONFIRMATION (dépense à confirmer par le président)
            jdbc.execute("ALTER TABLE operations DROP CONSTRAINT IF EXISTS operations_statut_check");
            jdbc.execute("ALTER TABLE operations ADD CONSTRAINT operations_statut_check CHECK (statut IN ('ENREGISTREE', 'ANNULEE', 'EN_ATTENTE_CONFIRMATION'))");
            // La photo de profil (image encodée) ne tient pas dans le varchar(255) créé à l'origine
            jdbc.execute("ALTER TABLE membres ALTER COLUMN photo_url TYPE TEXT");
            // Numéro de membre pour les comptes créés avant que le numéro soit attribué automatiquement
            jdbc.execute("UPDATE membres SET matricule = 'MAD-' || LPAD(id::text, 4, '0') WHERE matricule IS NULL OR matricule = ''");
        } catch (Exception e) {
            log.warn("Mise à niveau de la contrainte des rôles impossible : {}", e.getMessage());
        }
    }
}
