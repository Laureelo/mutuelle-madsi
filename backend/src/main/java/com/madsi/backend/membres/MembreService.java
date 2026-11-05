package com.madsi.backend.membres;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.cotisations.CotisationRepository;
import com.madsi.backend.historique.HistoriqueRepository;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.dto.MembreCreateDTO;
import com.madsi.backend.membres.dto.MembreDTO;
import com.madsi.backend.membres.dto.MembreUpdateDTO;
import com.madsi.backend.operations.OperationRepository;
import com.madsi.backend.prets.PretRepository;

import lombok.Data;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MembreService {

    private final MembreRepository repo;
    private final com.madsi.backend.notifications.NotificationService notifications;
    private final PasswordEncoder encoder;
    private final HistoriqueService histo;
    private final HistoriqueRepository historiqueRepo;
    private final CotisationRepository cotisationRepo;
    private final OperationRepository operationRepo;
    private final PretRepository pretRepo;
    private final com.madsi.backend.adhesion.AdhesionRepository adhesionRepo;

    private MembreDTO toDTO(Membre m) {
        return new MembreDTO(
                m.getId(), m.getMatricule(), m.getMatriculeFonctionPublique(), m.getUsername(), m.getEmail(), m.getPhone(),
                m.getFirstName(), m.getLastName(), m.getFonction(), m.getRole(),
                m.getEtatCompte(), m.getDateAdhesion(),
                m.getDateRegistered(), m.getDateValidated(), m.getValidePar(),
                m.getDateValidatedTresorerie(), m.getValideParTresorerie(), m.getPhotoUrl(),
                !Boolean.FALSE.equals(m.getNotificationsEmail())
        );
    }

    // -------- Register (utilisé par AuthController)
    @Transactional
    public Membre register(RegisterInput in){
        if (in.getUsername()==null || in.getUsername().isBlank())
            throw new IllegalArgumentException("Le nom d'utilisateur est requis");
        if (in.getEmail()==null || in.getEmail().isBlank())
            throw new IllegalArgumentException("L'email est requis");
        verifierMotDePasse(in.getPassword());

        // Normaliser avant les vérifications d'unicité
        String username = in.getUsername().trim();
        String email    = in.getEmail().trim().toLowerCase();
        verifierIdentifiant(username);
        verifierEmail(email);
        if (in.getPhone() != null && !in.getPhone().isBlank()) verifierTelephone(in.getPhone());

        if (repo.existsByUsername(username))
            throw new IllegalArgumentException("Ce nom d'utilisateur est déjà utilisé");
        if (repo.existsByEmail(email))
            throw new IllegalArgumentException("Cet email est déjà utilisé");

        var m = new Membre();
        m.setUsername(username);
        m.setEmail(email);
        m.setPhone(nullToEmpty(in.getPhone()));
        m.setFirstName(nullToEmpty(in.getFirstName()));
        m.setLastName(nullToEmpty(in.getLastName()));
        // Garder null si vide — les contraintes UNIQUE en PG acceptent plusieurs NULL mais pas plusieurs ""
        String mfp = in.getMatriculeFonctionPublique();
        m.setMatriculeFonctionPublique(mfp != null && !mfp.isBlank() ? mfp.trim() : null);
        m.setFonction(nullToEmpty(in.getFonction()));
        m.setRole(RoleMembre.VISITEUR); // Rôle VISITEUR jusqu'à activation par l'admin
        m.setEtatCompte(Enums.EtatCompte.VISITEUR);
        m.setDateRegistered(OffsetDateTime.now());
        m.setPassword(encoder.encode(in.getPassword())); // ⚠ le hash est stocké dans password

        var saved = attribuerMatricule(repo.save(m));

        histo.enregistrer(saved.getId(),
                "Inscription",
                "Compte créé avec rôle VISITEUR et statut VISITEUR - L'admin attribuera le rôle MEMBRE après validation du paiement par le trésorier",
                Enums.HistoType.ADHESION);

        notifications.sansRisque(() -> notifications.informer(saved.getId(), Enums.NotifType.INFO, "Bienvenue à la mutuelle",
                "Votre compte est créé. Pour devenir membre, réglez le droit d'adhésion (voir la rubrique Adhésion de l'application) "
                        + "et déclarez votre paiement ; le trésorier le validera, puis l'administrateur activera votre compte.",
                Enums.TopicType.AUTRE, saved.getId(), true));

        return saved;
    }

    /** Numéro de membre MADSI (ex. MAD-0007), attribué dès la création du compte. */
    private Membre attribuerMatricule(Membre saved) {
        if (saved.getMatricule() == null || saved.getMatricule().isBlank()) {
            saved.setMatricule(String.format("MAD-%04d", saved.getId()));
            return repo.save(saved);
        }
        return saved;
    }

    /** Définit un nouveau mot de passe sans demander l'ancien (lien de réinitialisation reçu par email). */
    public void definirMotDePasse(Long membreId, String nouveau) {
        verifierMotDePasse(nouveau);
        var m = repo.findById(membreId).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        m.setPassword(encoder.encode(nouveau));
        repo.save(m);
        histo.enregistrer(m.getId(), "Réinitialisation du mot de passe", "Par lien reçu par email", Enums.HistoType.PARAMETRE);
    }

    /**
     * Réinitialisation par l'administrateur (quand le membre ne peut pas utiliser « mot de passe oublié »).
     * Retourne un mot de passe provisoire, à transmettre au membre, qui le changera depuis son profil.
     */
    public String reinitialiserParAdmin(Long membreId, Long adminId) {
        var m = repo.findById(membreId).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        final String lettres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
        final String chiffres = "23456789";
        var alea = new java.security.SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 7; i++) sb.append(lettres.charAt(alea.nextInt(lettres.length())));
        for (int i = 0; i < 3; i++) sb.append(chiffres.charAt(alea.nextInt(chiffres.length())));
        java.util.List<Character> mel = new java.util.ArrayList<>();
        for (char c : sb.toString().toCharArray()) mel.add(c);
        java.util.Collections.shuffle(mel, alea);
        StringBuilder out = new StringBuilder();
        mel.forEach(out::append);
        String provisoire = out.toString();
        m.setPassword(encoder.encode(provisoire));
        repo.save(m);
        histo.enregistrer(m.getId(), "Mot de passe réinitialisé par l'administrateur", "adminId=" + adminId, Enums.HistoType.PARAMETRE);
        return provisoire;
    }

    public void changePassword(Long membreId, String oldPassword, String newPassword) {
        verifierMotDePasse(newPassword);
        var m = repo.findById(membreId).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        if (m.getPassword()!=null && !m.getPassword().isBlank()) {
            if (oldPassword==null || oldPassword.isBlank() || !encoder.matches(oldPassword, m.getPassword())) {
                throw new IllegalArgumentException("Ancien mot de passe incorrect");
            }
        }
        m.setPassword(encoder.encode(newPassword));
        repo.save(m);

        histo.enregistrer(m.getId(),
                "Changement de mot de passe",
                null,
                Enums.HistoType.PARAMETRE);
    }

    public PageResponse<MembreDTO> search(String q, String etatCompte, String role, int page, int size) {
        try {
            var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
            Page<Membre> p;
            
            // Construire la requête avec filtres
            if ((q == null || q.isBlank()) && (etatCompte == null || etatCompte.isBlank()) && (role == null || role.isBlank())) {
                // Pas de filtres, récupérer tout
                p = repo.findAll(pageable);
            } else {
                // Appliquer les filtres
                var spec = buildSearchSpec(q, etatCompte, role);
                p = repo.findAll(spec, pageable);
            }
            
            // Convertir en DTO avec gestion d'erreur
            Page<MembreDTO> dtoPage = p.map(m -> {
                try {
                    return toDTO(m);
                } catch (Exception e) {
                    System.err.println("Erreur conversion Membre en DTO (id=" + m.getId() + "): " + e.getMessage());
                    e.printStackTrace();
                    throw new RuntimeException("Erreur conversion membre id=" + m.getId() + ": " + e.getMessage(), e);
                }
            });
            
            return PageResponse.of(dtoPage);
        } catch (Exception e) {
            System.err.println("=== ERREUR dans MembreService.search ===");
            System.err.println("q=" + q + ", etatCompte=" + etatCompte + ", role=" + role);
            System.err.println("page=" + page + ", size=" + size);
            e.printStackTrace();
            throw e;
        }
    }
    
    private Specification<Membre> buildSearchSpec(String q, String etatCompte, String role) {
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            
            // Recherche textuelle
            if (q != null && !q.isBlank()) {
                var qLower = q.toLowerCase();
                predicates.add(cb.or(
                    cb.like(cb.lower(cb.coalesce(root.get("firstName"), cb.literal(""))), "%" + qLower + "%"),
                    cb.like(cb.lower(cb.coalesce(root.get("lastName"), cb.literal(""))), "%" + qLower + "%"),
                    cb.like(cb.lower(cb.coalesce(root.get("email"), cb.literal(""))), "%" + qLower + "%")
                ));
            }
            
            // Filtre par état
            if (etatCompte != null && !etatCompte.isBlank()) {
                try {
                    var etat = Enums.EtatCompte.valueOf(etatCompte.toUpperCase());
                    predicates.add(cb.equal(root.get("etatCompte"), etat));
                } catch (IllegalArgumentException e) {
                    // Ignorer si valeur invalide
                }
            }
            
            // Filtre par rôle
            if (role != null && !role.isBlank()) {
                try {
                    var roleEnum = RoleMembre.valueOf(role.toUpperCase());
                    predicates.add(cb.equal(root.get("role"), roleEnum));
                } catch (IllegalArgumentException e) {
                    // Ignorer si valeur invalide
                }
            }
            
            if (predicates.isEmpty()) {
                return cb.conjunction(); // Retourner toujours true si aucun prédicat
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    public MembreDTO get(Long id) {
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        return toDTO(m);
    }

    /**
     * Mise à jour de SON PROPRE profil : seuls les champs personnels sont pris en compte
     * (jamais le rôle, l'état du compte ni le nom d'utilisateur).
     */
    @Transactional
    public MembreDTO updateProfil(Long id, com.madsi.backend.membres.dto.ProfilUpdateDTO in) {
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Membre introuvable"));

        if (in.firstName() != null && !in.firstName().isBlank()) m.setFirstName(in.firstName().trim());
        if (in.lastName() != null && !in.lastName().isBlank()) m.setLastName(in.lastName().trim());
        if (in.email() != null && !in.email().isBlank()) {
            String email = in.email().trim().toLowerCase();
            if (!email.equalsIgnoreCase(m.getEmail())) {
                verifierEmail(email);
                if (repo.existsByEmail(email)) throw new IllegalArgumentException("Cet email est déjà utilisé");
                m.setEmail(email);
            }
        }
        if (in.phone() != null) {
            if (!in.phone().isBlank()) verifierTelephone(in.phone());
            m.setPhone(in.phone().trim());
        }
        if (in.matriculeFonctionPublique() != null) {
            String mfp = in.matriculeFonctionPublique().trim();
            m.setMatriculeFonctionPublique(mfp.isEmpty() ? null : mfp);
        }
        if (in.fonction() != null) m.setFonction(in.fonction().trim());
        if (in.photoUrl() != null) m.setPhotoUrl(in.photoUrl().isBlank() ? null : in.photoUrl());
        if (in.notificationsEmail() != null) m.setNotificationsEmail(in.notificationsEmail());

        var out = repo.save(m);
        histo.enregistrer(m.getId(), "Mise à jour du profil", "Modification par le membre", Enums.HistoType.PARAMETRE);
        return toDTO(out);
    }

    /** Modification d'un compte par un administrateur (rôle et état inclus). */
    @Transactional
    public MembreDTO update(Long id, MembreUpdateDTO in) {
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Membre introuvable"));

        // Garde-fous sur les comptes d'administration
        boolean cible = estMoiMeme(m);
        if (in.role() != null && in.role() != m.getRole()) {
            if (cible) throw new IllegalStateException("Vous ne pouvez pas modifier votre propre rôle.");
            verifierPasDernierAdmin(m);
        }
        if (in.etatCompte() != null && in.etatCompte() != m.getEtatCompte() && in.etatCompte() != Enums.EtatCompte.ACTIF) {
            if (cible) throw new IllegalStateException("Vous ne pouvez pas désactiver votre propre compte.");
            verifierPasDernierAdmin(m);
        }
        if (in.username() != null && !in.username().equals(m.getUsername())) {
            verifierIdentifiant(in.username().trim());
            if (repo.existsByUsername(in.username().trim())) throw new IllegalArgumentException("Ce nom d'utilisateur est déjà utilisé");
        }
        if (in.email() != null && !in.email().trim().equalsIgnoreCase(m.getEmail())) {
            verifierEmail(in.email().trim().toLowerCase());
            if (repo.existsByEmail(in.email().trim().toLowerCase())) throw new IllegalArgumentException("Cet email est déjà utilisé");
        }

        // Note: matricule MADSI n'est plus modifiable par l'admin (généré automatiquement)
        if (in.username() != null) m.setUsername(in.username().trim());
        if (in.email() != null) m.setEmail(in.email().trim().toLowerCase());
        if (in.phone() != null) m.setPhone(in.phone());
        if (in.firstName() != null) m.setFirstName(in.firstName());
        if (in.lastName() != null) m.setLastName(in.lastName());
        if (in.matriculeFonctionPublique() != null) m.setMatriculeFonctionPublique(in.matriculeFonctionPublique());
        if (in.fonction() != null) m.setFonction(in.fonction());
        if (in.role() != null) m.setRole(in.role());
        if (in.etatCompte() != null) m.setEtatCompte(in.etatCompte());
        if (in.photoUrl() != null) m.setPhotoUrl(in.photoUrl());

        var out = repo.save(m);

        histo.enregistrer(m.getId(),
                "Mise à jour du profil",
                "Champs principaux modifiés",
                Enums.HistoType.PARAMETRE);

        return toDTO(out);
    }

    /**
     * Validation de paiement d'adhésion par la trésorerie :
     * Passe de VISITEUR à VALIDE_PAR_TRESORERIE (en attente d'activation par l'admin)
     */
    public MembreDTO validerAdhesion(Long membreId, Long tresorierId) {
        var m = repo.findById(membreId).orElseThrow(() -> new NotFoundException("Membre introuvable"));

        if (m.getEtatCompte() != Enums.EtatCompte.VISITEUR) {
            throw new IllegalStateException("Le compte doit être en statut VISITEUR pour valider l'adhésion");
        }

        // Passage à VALIDE_PAR_TRESORERIE après validation du paiement d'adhésion
        // L'admin devra ensuite activer manuellement le compte
        m.setEtatCompte(Enums.EtatCompte.VALIDE_PAR_TRESORERIE);
        m.setDateAdhesion(LocalDate.now());
        m.setValideParTresorerie(tresorierId);
        m.setDateValidatedTresorerie(OffsetDateTime.now());
        var out = toDTO(repo.save(m));

        histo.enregistrer(membreId,
                "Validation adhésion MADSI",
                "Paiement d'adhésion validé par trésorier userId=" + tresorierId + " - Statut VISITEUR → VALIDE_PAR_TRESORERIE (en attente d'activation par l'admin)",
                Enums.HistoType.ADHESION);

        return out;
    }

    /**
     * Validation par la trésorerie (ancien flux - gardé pour compatibilité) :
     * Passe de EN_ATTENTE à VALIDE_PAR_TRESORERIE
     * @deprecated Utiliser validerAdhesion() pour le nouveau flux VISITEUR → ACTIF
     */
    @Deprecated
    public MembreDTO validerParTresorerie(Long membreId, Long tresorierId) {
        var m = repo.findById(membreId).orElseThrow(() -> new NotFoundException("Membre introuvable"));

        if (m.getEtatCompte() != Enums.EtatCompte.EN_ATTENTE) {
            throw new IllegalStateException("Le compte doit être en EN_ATTENTE pour être validé par la trésorerie");
        }

        m.setEtatCompte(Enums.EtatCompte.VALIDE_PAR_TRESORERIE);
        m.setValideParTresorerie(tresorierId);
        m.setDateValidatedTresorerie(OffsetDateTime.now());
        var out = toDTO(repo.save(m));

        histo.enregistrer(membreId,
                "Validation par trésorerie",
                "Validé par trésorier userId="+tresorierId,
                Enums.HistoType.ADHESION);

        return out;
    }

    /**
     * Activation par l'administrateur :
     * Passe de VALIDE_PAR_TRESORERIE a ACTIF
     * Etape finale apres validation du paiement par le tresorier
     */
    public MembreDTO activerCompte(Long membreId, Long adminId) {
        var m = repo.findById(membreId).orElseThrow(() -> new NotFoundException("Membre introuvable"));

        if (m.getEtatCompte() != Enums.EtatCompte.VALIDE_PAR_TRESORERIE) {
            throw new IllegalStateException("Le compte doit etre valide par la tresorerie avant activation par l'admin");
        }

        m.setEtatCompte(Enums.EtatCompte.ACTIF);
        m.setRole(RoleMembre.MEMBRE); // Passage définitif au rôle MEMBRE
        m.setValidePar(adminId);
        m.setDateValidated(OffsetDateTime.now());
        m.setDateAdhesion(LocalDate.now());
        var out = toDTO(repo.save(m));

        histo.enregistrer(membreId,
                "Activation du compte",
                "Active par admin userId=" + adminId + " - Statut ACTIF, Role MEMBRE",
                Enums.HistoType.ADHESION);

        notifications.sansRisque(() -> notifications.informer(membreId, Enums.NotifType.INFO, "Votre compte est activé",
                "Félicitations, vous êtes désormais membre actif de la mutuelle : cotisations, prêts et manifestations sont à votre disposition.",
                Enums.TopicType.AUTRE, membreId, true));

        return out;
    }

    /**
     * Liste les membres en attente d'activation par l'admin
     */
    public List<MembreDTO> getMembresEnAttenteActivation() {
        return repo.findByEtatCompte(Enums.EtatCompte.VALIDE_PAR_TRESORERIE)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public MembreDTO desactiver(Long id, Long adminId) {
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        if (estMoiMeme(m)) throw new IllegalStateException("Vous ne pouvez pas désactiver votre propre compte.");
        verifierPasDernierAdmin(m);
        m.setEtatCompte(Enums.EtatCompte.INACTIF);
        m.setValidePar(adminId);
        var out = toDTO(repo.save(m));

        histo.enregistrer(id,
                "Désactivation du compte",
                "Par userId="+adminId,
                Enums.HistoType.PARAMETRE);

        return out;
    }

    public MembreDTO reactiver(Long id, Long adminId) {
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        m.setEtatCompte(Enums.EtatCompte.ACTIF);
        m.setValidePar(adminId);
        m.setDateValidated(OffsetDateTime.now());
        var out = toDTO(repo.save(m));

        histo.enregistrer(id,
                "Réactivation du compte",
                "Par userId="+adminId,
                Enums.HistoType.PARAMETRE);

        return out;
    }

    public MembreDTO changerRole(Long id, RoleMembre nouveauRole, Long adminId) {
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Membre introuvable"));
        var ancien = m.getRole();
        if (ancien != nouveauRole) {
            if (estMoiMeme(m)) throw new IllegalStateException("Vous ne pouvez pas modifier votre propre rôle.");
            verifierPasDernierAdmin(m);
        }
        m.setRole(nouveauRole);
        m.setValidePar(adminId);
        var out = toDTO(repo.save(m));

        histo.enregistrer(id,
                "Changement de rôle",
                "De "+ancien+" à "+nouveauRole+" par userId="+adminId,
                Enums.HistoType.PARAMETRE);

        return out;
    }

    // -------- Create (pour admin)
    public MembreDTO create(MembreCreateDTO in) {
        // Validation des champs obligatoires (les annotations @NotBlank du DTO sont déjà vérifiées par Spring)
        // Mais on fait une double vérification pour des messages plus clairs
        if (in.username() == null || in.username().trim().isBlank())
            throw new IllegalArgumentException("Le nom d'utilisateur est requis");
        if (in.email() == null || in.email().trim().isBlank())
            throw new IllegalArgumentException("L'email est requis");
        verifierMotDePasse(in.password());
        verifierIdentifiant(in.username().trim());
        verifierEmail(in.email().trim().toLowerCase());
        if (in.phone() != null && !in.phone().isBlank()) verifierTelephone(in.phone());
        if (in.firstName() == null || in.firstName().trim().isBlank())
            throw new IllegalArgumentException("Le prénom est requis");
        if (in.lastName() == null || in.lastName().trim().isBlank())
            throw new IllegalArgumentException("Le nom est requis");

        // Vérification des contraintes d'unicité avant de créer
        String usernameTrimmed = in.username().trim();
        String emailTrimmed = in.email().trim().toLowerCase();
        
        if (repo.existsByUsername(usernameTrimmed))
            throw new IllegalArgumentException("Ce nom d'utilisateur est déjà utilisé");
        if (repo.existsByEmail(emailTrimmed))
            throw new IllegalArgumentException("Cet email est déjà utilisé");

        // Création de l'entité
        var m = new Membre();
        m.setUsername(usernameTrimmed);
        m.setEmail(emailTrimmed);
        m.setPhone(nullToEmpty(in.phone()));
        m.setFirstName(in.firstName().trim());
        m.setLastName(in.lastName().trim());
        m.setMatriculeFonctionPublique(nullToEmpty(in.matriculeFonctionPublique()));
        m.setFonction(nullToEmpty(in.fonction()));
        m.setRole(in.role() != null ? in.role() : RoleMembre.VISITEUR); // Par défaut VISITEUR
        m.setEtatCompte(in.etatCompte() != null ? in.etatCompte() : Enums.EtatCompte.EN_ATTENTE);
        m.setDateRegistered(OffsetDateTime.now());
        // Un compte créé directement ACTIF (reprise de membres existants) commence à cotiser à partir d'aujourd'hui
        if (m.getEtatCompte() == Enums.EtatCompte.ACTIF) m.setDateAdhesion(LocalDate.now());
        m.setPassword(encoder.encode(in.password()));

        try {
            var saved = attribuerMatricule(repo.save(m));

            histo.enregistrer(saved.getId(),
                    "Création de compte",
                    "Compte créé par admin avec rôle " + saved.getRole() + " et état " + saved.getEtatCompte(),
                    Enums.HistoType.ADHESION);

            return toDTO(saved);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Capturer les violations de contrainte de base de données (sécurité supplémentaire)
            String message = e.getMessage();
            if (message != null) {
                if (message.contains("username") || (message.contains("uk_") && message.contains("username"))) {
                    throw new IllegalArgumentException("Ce nom d'utilisateur est déjà utilisé");
                } else if (message.contains("email") || (message.contains("uk_") && message.contains("email"))) {
                    throw new IllegalArgumentException("Cet email est déjà utilisé");
                } else if (message.contains("matricule")) {
                    throw new IllegalArgumentException("Ce matricule est déjà utilisé");
                }
            }
            throw new IllegalArgumentException("Contrainte de données violée : vérifiez que le nom d'utilisateur et l'email sont uniques");
        }
    }

    /**
     * Suppression d'un membre
     * Vérifie d'abord que le membre n'a pas de données associées (cotisations, opérations, prêts)
     */
    @Transactional
    public void delete(Long id) {
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Membre introuvable"));

        if (estMoiMeme(m)) throw new IllegalStateException("Vous ne pouvez pas supprimer votre propre compte.");
        verifierPasDernierAdmin(m);

        // Vérifier les contraintes avant suppression
        var errors = new java.util.ArrayList<String>();

        if (cotisationRepo.existsByMembreId(id)) {
            errors.add("Le membre a des cotisations enregistrées");
        }
        if (operationRepo.existsByMembreId(id)) {
            errors.add("Le membre a des opérations financières");
        }
        if (pretRepo.existsByMembreId(id)) {
            errors.add("Le membre a des prêts");
        }
        if (adhesionRepo.existsByMembreId(id)) {
            errors.add("Le membre a des adhésions enregistrées");
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException(
                "Impossible de supprimer ce membre : " + String.join(", ", errors)
            );
        }

        // Enregistrer la suppression dans l'historique avant de supprimer
        histo.enregistrer(id,
                "Suppression du compte",
                "Membre " + m.getUsername() + " supprimé",
                Enums.HistoType.PARAMETRE);

        // Supprimer l'historique du membre (orphelins)
        historiqueRepo.deleteByMembreId(id);

        // Supprimer le membre
        repo.deleteById(id);
    }

    private static String nullToEmpty(String s){ return s==null ? "" : s; }

    // ------------------------------------------------------------------
    // Validations et garde-fous
    // ------------------------------------------------------------------
    public static final int MOT_DE_PASSE_MIN = 8;

    private static final java.util.regex.Pattern IDENTIFIANT =
            java.util.regex.Pattern.compile("^[A-Za-z0-9._@-]{3,50}$");
    private static final java.util.regex.Pattern EMAIL =
            java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final java.util.regex.Pattern TELEPHONE =
            java.util.regex.Pattern.compile("^\\+?[0-9 .()-]{8,20}$");

    /** Au moins 8 caractères, avec au moins une lettre et un chiffre. */
    public static void verifierMotDePasse(String mdp) {
        if (mdp == null || mdp.length() < MOT_DE_PASSE_MIN)
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins " + MOT_DE_PASSE_MIN + " caractères");
        boolean lettre = mdp.chars().anyMatch(Character::isLetter);
        boolean chiffre = mdp.chars().anyMatch(Character::isDigit);
        if (!lettre || !chiffre)
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins une lettre et un chiffre");
    }

    private static void verifierIdentifiant(String username) {
        if (!IDENTIFIANT.matcher(username).matches())
            throw new IllegalArgumentException(
                    "Le nom d'utilisateur doit faire 3 à 50 caractères (lettres, chiffres, point, tiret, tiret bas ou @)");
    }

    private static void verifierEmail(String email) {
        if (!EMAIL.matcher(email).matches())
            throw new IllegalArgumentException("Adresse email invalide");
    }

    private static void verifierTelephone(String phone) {
        if (!TELEPHONE.matcher(phone.trim()).matches())
            throw new IllegalArgumentException("Numéro de téléphone invalide (ex : +226 70 00 00 00)");
    }

    /** Le compte ciblé est-il celui de l'utilisateur connecté ? */
    private boolean estMoiMeme(Membre cible) {
        String moi = com.madsi.backend.security.CurrentUser.username();
        return moi != null && moi.equals(cible.getUsername());
    }

    /** Interdit de retirer, désactiver ou supprimer le dernier administrateur actif. */
    private void verifierPasDernierAdmin(Membre cible) {
        if (cible.getRole() == RoleMembre.ADMIN && cible.getEtatCompte() == Enums.EtatCompte.ACTIF
                && repo.countByRoleAndEtatCompte(RoleMembre.ADMIN, Enums.EtatCompte.ACTIF) <= 1) {
            throw new IllegalStateException("Opération refusée : c'est le dernier administrateur actif.");
        }
    }

    // -------- DTO interne utilisé par /auth/register
    @Data
    public static class RegisterInput {
        private String firstName;
        private String lastName;
        private String email;
        private String phone;
        private String username;
        private String password;
        private String matriculeFonctionPublique; // Matricule de la fonction publique (saisi lors de l'inscription)
        private String fonction;
    }
}