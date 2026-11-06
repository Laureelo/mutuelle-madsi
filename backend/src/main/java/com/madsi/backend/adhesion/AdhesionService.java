package com.madsi.backend.adhesion;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.membres.MembreService;
import com.madsi.backend.operations.Operation;
import com.madsi.backend.operations.OperationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdhesionService {

    private final AdhesionRepository adhesionRepo;
    private final MembreRepository membreRepo;
    private final MembreService membreService;
    private final OperationRepository operationRepo;
    private final HistoriqueService historiqueService;
    private final com.madsi.backend.settings.SettingsService settingsService;
    private final com.madsi.backend.operations.ReceiptService receiptService;

    /**
     * Constante du montant d'adhésion MADSI
     */
    // Le montant est lu dans les paramètres (règlement intérieur, art. 9 : 2 000 FCFA par défaut).

    /**
     * Déclaration d'un paiement d'adhésion par un membre VISITEUR
     */
    @Transactional
    public Adhesion declarer(Long membreId, Enums.ModePaiement modePaiement, String reference, String remarque, String photoPreuve) {
        if (photoPreuve != null && photoPreuve.length() > 3_000_000) {
            throw new IllegalArgumentException("L'image jointe est trop volumineuse (2 Mo maximum).");
        }
        // Vérifier que le membre existe
        var membre = membreRepo.findById(membreId)
                .orElseThrow(() -> new NotFoundException("Membre introuvable"));

        // Vérifier que le membre est bien en statut VISITEUR
        if (membre.getEtatCompte() != Enums.EtatCompte.VISITEUR) {
            throw new IllegalStateException("Seuls les membres avec le statut VISITEUR peuvent déclarer une adhésion");
        }

        // Vérifier qu'il n'a pas déjà une adhésion validée
        if (adhesionRepo.existsByMembreIdAndStatut(membreId, Adhesion.StatutAdhesion.VALIDE)) {
            throw new IllegalStateException("Ce membre a déjà une adhésion validée");
        }

        // Vérifier qu'il n'a pas déjà une adhésion en attente
        if (adhesionRepo.existsByMembreIdAndStatut(membreId, Adhesion.StatutAdhesion.EN_ATTENTE)) {
            throw new IllegalStateException("Vous avez déjà une déclaration d'adhésion en attente de validation");
        }

        // Créer l'adhésion
        var adhesion = new Adhesion();
        adhesion.setMembreId(membreId);
        adhesion.setMontant(settingsService.montantAdhesion());
        adhesion.setDatePaiement(OffsetDateTime.now());
        adhesion.setModePaiement(modePaiement);
        adhesion.setReference(reference);
        adhesion.setRemarque(remarque);
        adhesion.setPhotoPreuve(photoPreuve);
        adhesion.setStatut(Adhesion.StatutAdhesion.EN_ATTENTE);

        var saved = adhesionRepo.save(adhesion);

        // Enregistrer dans l'historique
        historiqueService.enregistrer(
                membreId,
                "Déclaration paiement adhésion",
                "Montant: " + settingsService.montantAdhesion() + " FCFA - Mode: " + modePaiement + " - Référence: " + reference,
                Enums.HistoType.ADHESION
        );

        return saved;
    }

    /**
     * Validation d'une adhésion par le trésorier
     */
    @Transactional
    public Adhesion valider(Long adhesionId, Long tresorierId) {
        var adhesion = adhesionRepo.findById(adhesionId)
                .orElseThrow(() -> new NotFoundException("Adhésion introuvable"));

        if (adhesion.getStatut() != Adhesion.StatutAdhesion.EN_ATTENTE) {
            throw new IllegalStateException("Seules les adhésions EN_ATTENTE peuvent être validées");
        }

        // Créer l'opération comptable (APPORT pour adhésion, pas COTISATION)
        // Utiliser la date actuelle (date de validation) pour que l'opération soit incluse dans les stats de l'année en cours
        // La date de paiement déclarée est conservée dans l'adhésion pour traçabilité
        var operation = Operation.builder()
                .membreId(adhesion.getMembreId())
                .montant(adhesion.getMontant())
                .dateOp(OffsetDateTime.now()) // Date de validation = date d'entrée dans la trésorerie
                .sens(Enums.SensOp.ENTREE)
                .typeOp(Enums.TypeOperation.APPORT) // APPORT pour adhésion, pas COTISATION
                .modePaiement(adhesion.getModePaiement())
                .reference(adhesion.getReference())
                .statut(Enums.OpStatut.ENREGISTREE)
                .objetType("adhesion")
                .objetId(adhesion.getId())
                .build();
        var savedOperation = operationRepo.save(operation);
        operationRepo.flush();

        // Reçu de versement (statuts, art. 20 : un reçu pour toute somme versée)
        receiptService.generate(savedOperation, Enums.ObjetRecu.ADHESION, adhesion.getMontant(),
                adhesion.getModePaiement(), adhesion.getReference(), "Droit d'adhésion à la mutuelle");

        // Enregistrer dans l'historique système
        historiqueService.enregistrer(
                adhesion.getMembreId(),
                "Opération ENTREE - Adhésion",
                "type=APPORT, montant=" + adhesion.getMontant() + ", objet=adhesion/" + adhesion.getId(),
                Enums.HistoType.SYSTEME,
                "adhesion",
                adhesion.getId()
        );

        // Mettre à jour l'adhésion
        adhesion.setStatut(Adhesion.StatutAdhesion.VALIDE);
        adhesion.setValideParTresorerie(tresorierId);
        adhesion.setDateValidation(OffsetDateTime.now());
        adhesion.setOperationId(savedOperation.getId());
        var savedAdhesion = adhesionRepo.save(adhesion);

        // Activer le compte membre via MembreService
        membreService.validerAdhesion(adhesion.getMembreId(), tresorierId);

        // Enregistrer dans l'historique
        historiqueService.enregistrer(
                adhesion.getMembreId(),
                "Validation adhésion MADSI",
                "Paiement de " + adhesion.getMontant() + " FCFA validé par trésorier - Compte en attente d'activation par l'administrateur",
                Enums.HistoType.ADHESION
        );

        return savedAdhesion;
    }

    /**
     * Rejet d'une adhésion par le trésorier
     */
    @Transactional
    public Adhesion rejeter(Long adhesionId, Long tresorierId, String motifRejet) {
        var adhesion = adhesionRepo.findById(adhesionId)
                .orElseThrow(() -> new NotFoundException("Adhésion introuvable"));

        if (adhesion.getStatut() != Adhesion.StatutAdhesion.EN_ATTENTE) {
            throw new IllegalStateException("Seules les adhésions EN_ATTENTE peuvent être rejetées");
        }

        adhesion.setStatut(Adhesion.StatutAdhesion.REJETE);
        adhesion.setValideParTresorerie(tresorierId);
        adhesion.setDateValidation(OffsetDateTime.now());
        adhesion.setMotifRejet(motifRejet);

        var saved = adhesionRepo.save(adhesion);

        // Enregistrer dans l'historique
        historiqueService.enregistrer(
                adhesion.getMembreId(),
                "Rejet adhésion",
                "Motif: " + motifRejet,
                Enums.HistoType.ADHESION
        );

        return saved;
    }

    /**
     * Récupérer toutes les adhésions d'un membre
     */
    public List<Adhesion> getByMembre(Long membreId) {
        return adhesionRepo.findByMembreId(membreId);
    }

    /**
     * Récupérer toutes les adhésions en attente
     */
    public List<Adhesion> getEnAttente() {
        return adhesionRepo.findByStatut(Adhesion.StatutAdhesion.EN_ATTENTE);
    }

    /**
     * Récupérer toutes les adhésions (triées par ID décroissant)
     */
    public List<Adhesion> getAll() {
        return adhesionRepo.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }

    /**
     * Récupérer une adhésion par ID
     */
    public Adhesion getById(Long id) {
        return adhesionRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Adhésion introuvable"));
    }

    /**
     * Statistiques des adhésions
     */
    public AdhesionStats getStats() {
        long enAttente = adhesionRepo.countEnAttente();
        long validees = adhesionRepo.countValidees();
        long total = adhesionRepo.count();

        return new AdhesionStats(total, validees, enAttente, total - validees - enAttente);
    }

    public record AdhesionStats(long total, long validees, long enAttente, long rejetees) {}
}
