package com.madsi.backend.adhesions;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.notifications.NotificationService;
import com.madsi.backend.operations.OperationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PaiementAdhesionService {

    private final PaiementAdhesionRepository paiementRepo;
    private final MembreRepository membreRepo;
    private final OperationService operationService;
    private final HistoriqueService historiqueService;
    private final com.madsi.backend.settings.SettingsService settingsService;
    private final NotificationService notificationService;

    /**
     * Montant fixe d'adhésion : 2000 F CFA
     */
    private BigDecimal montantAdhesion() { return settingsService.montantAdhesion(); }

    /**
     * Enregistrer un paiement d'adhésion (par le trésorier)
     */
    @Transactional
    public PaiementAdhesion enregistrerPaiement(
            Long membreId,
            Enums.ModePaiement modePaiement,
            OffsetDateTime datePaiement,
            String reference,
            String photoPreuve,
            String remarques,
            Long tresorerId
    ) {
        // Vérifier que le membre existe
        Membre membre = membreRepo.findById(membreId)
                .orElseThrow(() -> new NotFoundException("Membre introuvable avec l'ID: " + membreId));

        // Vérifier qu'il n'a pas déjà payé son adhésion
        if (paiementRepo.existsByMembreId(membreId)) {
            throw new IllegalStateException("Ce membre a déjà un paiement d'adhésion enregistré");
        }

        // Créer le paiement d'adhésion
        PaiementAdhesion paiement = PaiementAdhesion.builder()
                .membreId(membreId)
                .montant(montantAdhesion())
                .modePaiement(modePaiement)
                .datePaiement(datePaiement)
                .reference(reference)
                .photoPreuve(photoPreuve)
                .statut(PaiementAdhesion.StatutPaiementAdhesion.EN_ATTENTE)
                .enregistreParTresorier(tresorerId)
                .dateEnregistrement(OffsetDateTime.now())
                .remarques(remarques)
                .build();

        PaiementAdhesion saved = paiementRepo.save(paiement);

        // Mettre à jour l'état du membre : EN_ATTENTE -> VALIDE_PAR_TRESORERIE
        membre.setEtatCompte(Enums.EtatCompte.VALIDE_PAR_TRESORERIE);
        membre.setValideParTresorerie(tresorerId);
        membre.setDateValidatedTresorerie(OffsetDateTime.now());
        membreRepo.save(membre);

        // Enregistrer dans l'historique
        historiqueService.enregistrer(
                membreId,
                "Paiement adhésion enregistré par trésorerie",
                String.format("Montant: %s, Mode: %s, Référence: %s",
                    montantAdhesion(), modePaiement, reference),
                Enums.HistoType.ADHESION,
                "paiement_adhesion",
                saved.getId()
        );

        // Notifier les admins métier
        notifierAdminsMetier(membre, saved);

        return saved;
    }

    /**
     * Valider un paiement d'adhésion (par l'admin métier)
     */
    @Transactional
    public PaiementAdhesion validerPaiement(Long paiementId, Long adminId) {
        PaiementAdhesion paiement = paiementRepo.findById(paiementId)
                .orElseThrow(() -> new NotFoundException("Paiement introuvable avec l'ID: " + paiementId));

        if (paiement.getStatut() != PaiementAdhesion.StatutPaiementAdhesion.EN_ATTENTE) {
            throw new IllegalStateException("Ce paiement a déjà été traité");
        }

        // Mettre à jour le statut du paiement
        paiement.setStatut(PaiementAdhesion.StatutPaiementAdhesion.VALIDE);
        paiement.setValideParAdmin(adminId);
        paiement.setDateValidationAdmin(OffsetDateTime.now());

        // Créer une opération financière
        var operation = operationService.credit(
                Enums.TypeOperation.APPORT,
                paiement.getMontant(),
                paiement.getModePaiement(),
                paiement.getReference(),
                paiement.getMembreId(),
                "paiement_adhesion",
                paiement.getId()
        );

        paiement.setOperationId(operation.getId());
        PaiementAdhesion saved = paiementRepo.save(paiement);

        // Mettre à jour le membre : VALIDE_PAR_TRESORERIE -> ACTIF
        Membre membre = membreRepo.findById(paiement.getMembreId())
                .orElseThrow(() -> new NotFoundException("Membre introuvable"));

        membre.setEtatCompte(Enums.EtatCompte.ACTIF);
        membre.setDateAdhesion(paiement.getDatePaiement().toLocalDate());
        membre.setDateValidated(OffsetDateTime.now());
        membre.setValidePar(adminId);
        membreRepo.save(membre);

        // Enregistrer dans l'historique
        historiqueService.enregistrer(
                paiement.getMembreId(),
                "Adhésion validée par admin métier",
                String.format("Paiement ID: %d, Opération ID: %d", paiement.getId(), operation.getId()),
                Enums.HistoType.ADHESION,
                "paiement_adhesion",
                saved.getId()
        );

        // Notifier le membre qu'il est activé
        notificationService.envoyer(
                Enums.NotifType.INFO,
                membre.getId(),
                Enums.Canal.EMAIL,
                "Adhésion validée",
                "Félicitations ! Votre adhésion a été validée. Vous êtes maintenant membre actif.",
                Enums.TopicType.AUTRE,
                paiement.getId()
        );

        return saved;
    }

    /**
     * Rejeter un paiement d'adhésion (par l'admin métier)
     */
    @Transactional
    public PaiementAdhesion rejeterPaiement(Long paiementId, Long adminId, String motif) {
        PaiementAdhesion paiement = paiementRepo.findById(paiementId)
                .orElseThrow(() -> new NotFoundException("Paiement introuvable avec l'ID: " + paiementId));

        if (paiement.getStatut() != PaiementAdhesion.StatutPaiementAdhesion.EN_ATTENTE) {
            throw new IllegalStateException("Ce paiement a déjà été traité");
        }

        // Mettre à jour le statut du paiement
        paiement.setStatut(PaiementAdhesion.StatutPaiementAdhesion.REJETE);
        paiement.setValideParAdmin(adminId);
        paiement.setDateValidationAdmin(OffsetDateTime.now());
        paiement.setRemarques(
                (paiement.getRemarques() != null ? paiement.getRemarques() + "\n" : "") +
                "Rejeté: " + motif
        );

        PaiementAdhesion saved = paiementRepo.save(paiement);

        // Remettre le membre en attente
        Membre membre = membreRepo.findById(paiement.getMembreId())
                .orElseThrow(() -> new NotFoundException("Membre introuvable"));

        membre.setEtatCompte(Enums.EtatCompte.EN_ATTENTE);
        membre.setValideParTresorerie(null);
        membre.setDateValidatedTresorerie(null);
        membreRepo.save(membre);

        // Enregistrer dans l'historique
        historiqueService.enregistrer(
                paiement.getMembreId(),
                "Paiement adhésion rejeté",
                String.format("Motif: %s", motif),
                Enums.HistoType.ADHESION,
                "paiement_adhesion",
                saved.getId()
        );

        // Notifier le membre
        notificationService.envoyer(
                Enums.NotifType.ALERTE,
                membre.getId(),
                Enums.Canal.EMAIL,
                "Paiement d'adhésion rejeté",
                "Votre paiement d'adhésion a été rejeté. Motif: " + motif,
                Enums.TopicType.AUTRE,
                paiement.getId()
        );

        return saved;
    }

    /**
     * Récupérer tous les paiements en attente (pour l'admin métier)
     */
    public PageResponse<PaiementAdhesion> getPaiementsEnAttente(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<PaiementAdhesion> result = paiementRepo.findByStatutOrderByDateEnregistrementDesc(
                PaiementAdhesion.StatutPaiementAdhesion.EN_ATTENTE,
                pageable
        );
        return new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    /**
     * Récupérer le paiement d'adhésion d'un membre
     */
    public PaiementAdhesion getPaiementByMembreId(Long membreId) {
        return paiementRepo.findByMembreId(membreId)
                .orElseThrow(() -> new NotFoundException(
                    "Aucun paiement d'adhésion trouvé pour le membre ID: " + membreId
                ));
    }

    /**
     * Compter les paiements en attente
     */
    public long countPaiementsEnAttente() {
        return paiementRepo.countByStatut(PaiementAdhesion.StatutPaiementAdhesion.EN_ATTENTE);
    }

    /**
     * Notifier les admins qu'un paiement est en attente de validation
     */
    private void notifierAdminsMetier(Membre membre, PaiementAdhesion paiement) {
        // Récupérer tous les admins
        List<Membre> admins = membreRepo.findAll().stream()
                .filter(m -> m.getRole() == com.madsi.backend.membres.RoleMembre.ADMIN)
                .filter(m -> m.getEtatCompte() == Enums.EtatCompte.ACTIF)
                .toList();

        // Envoyer une notification à chaque admin
        for (Membre admin : admins) {
            notificationService.envoyer(
                    Enums.NotifType.INFO,
                    admin.getId(),
                    Enums.Canal.PUSH,
                    "Nouveau paiement d'adhésion",
                    String.format(
                        "Un paiement d'adhésion de %s (%s %s) est en attente de validation.",
                        paiement.getMontant(),
                        membre.getFirstName(),
                        membre.getLastName()
                    ),
                    Enums.TopicType.AUTRE,
                    paiement.getId()
            );
        }
    }

    /**
     * Récupérer tous les paiements
     */
    public PageResponse<PaiementAdhesion> getAllPaiements(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<PaiementAdhesion> result = paiementRepo.findAll(pageable);
        return new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }
}
