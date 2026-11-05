package com.madsi.backend.config;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.membres.RoleMembre;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Au tout premier démarrage (aucun administrateur / trésorier en base), crée les deux comptes
 * indispensables pour pouvoir se connecter et administrer l'application.
 *
 * Aucun mot de passe n'est écrit dans le code : chaque mot de passe est généré aléatoirement,
 * affiché UNE fois dans la console et enregistré dans backend/data/identifiants-initiaux.txt
 * (dossier ignoré par Git). Il doit être changé dès la première connexion (menu « Mon Profil »).
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final Path FICHIER = Path.of("data", "identifiants-initiaux.txt");

    private final MembreRepository membreRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        var rapport = new StringBuilder();

        if (!membreRepository.existsByRole(RoleMembre.ADMIN)) {
            String mdp = motDePasseAleatoire();
            creer("MAT-ADMIN-001", "admin", mdp, "admin@madsi.local", "+22600000000",
                    "Admin", "Système", "Administrateur", RoleMembre.ADMIN);
            rapport.append("Administrateur  -> identifiant : admin        mot de passe : ").append(mdp).append('\n');
        }

        if (!membreRepository.existsByRole(RoleMembre.TRESORIER)) {
            String mdp = motDePasseAleatoire();
            creer("MAT-TRESO-001", "tresorier", mdp, "tresorier@madsi.local", "+22600000001",
                    "Trésorier", "Système", "Trésorier", RoleMembre.TRESORIER);
            rapport.append("Trésorier       -> identifiant : tresorier    mot de passe : ").append(mdp).append('\n');
        }

        if (rapport.length() > 0) {
            log.warn("""

                    ================================================================
                     PREMIER DÉMARRAGE - COMPTES CRÉÉS (à noter, affichés une seule fois)
                    ================================================================
                    {}
                     Changez ces mots de passe dès la première connexion.
                     Ils sont aussi enregistrés dans : {}
                    ================================================================
                    """, rapport, FICHIER.toAbsolutePath());
            try {
                Files.createDirectories(FICHIER.getParent());
                Files.writeString(FICHIER,
                        "Identifiants initiaux de MADSI - à changer dès la première connexion, puis supprimer ce fichier.\n\n" + rapport,
                        StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            } catch (IOException e) {
                log.warn("Impossible d'enregistrer {} : {}", FICHIER, e.getMessage());
            }
        }
    }

    private void creer(String matricule, String username, String motDePasse, String email, String phone,
                       String prenom, String nom, String fonction, RoleMembre role) {
        Membre m = new Membre();
        m.setMatricule(matricule);
        m.setUsername(username);
        m.setPassword(passwordEncoder.encode(motDePasse));
        m.setEmail(email);
        m.setPhone(phone);
        m.setFirstName(prenom);
        m.setLastName(nom);
        m.setFonction(fonction);
        m.setRole(role);
        m.setEtatCompte(Enums.EtatCompte.ACTIF);
        m.setDateAdhesion(LocalDate.now());
        m.setDateRegistered(OffsetDateTime.now());
        m.setDateValidated(OffsetDateTime.now());
        membreRepository.save(m);
    }

    private static String motDePasseAleatoire() {
        var rnd = new SecureRandom();
        var sb = new StringBuilder();
        for (int i = 0; i < 14; i++) sb.append(ALPHABET.charAt(rnd.nextInt(ALPHABET.length())));
        return sb.toString();
    }
}
