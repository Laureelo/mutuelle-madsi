// src/main/java/com/madsi/backend/operations/OperationService.java
package com.madsi.backend.operations;

import com.madsi.backend.common.Enums.*;
import com.madsi.backend.historique.HistoriqueService;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class OperationService {
    private final OperationRepository repo;
    private final HistoriqueService histo;
    private final com.madsi.backend.settings.SettingsService settingsService;
    private final com.madsi.backend.cotisations.CotisationRepository cotisationRepo;
    private final com.madsi.backend.manifestations.ManifestationRepository manifRepo;
    private final com.madsi.backend.notifications.NotificationService notifications;

    private static String fcfa(BigDecimal v) {
        return java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRANCE).format(v) + " FCFA";
    }

    /** Refuse une sortie d'argent si la caisse ne contient pas assez. */
    public void verifierSolde(BigDecimal montant) {
        BigDecimal solde = soldeActuel();
        if (solde.compareTo(montant) < 0) {
            throw new IllegalStateException("Solde de caisse insuffisant : " + fcfa(solde) + " disponibles pour une sortie de "
                    + fcfa(montant) + ".");
        }
    }

    /**
     * Dépense de caisse. Au-delà du seuil de confirmation, elle n'est enregistrée qu'à titre de demande :
     * elle n'entre pas dans la caisse tant que le président (administrateur) ne l'a pas confirmée.
     * (Statuts : le président ordonne les dépenses.)
     */
    public Operation depense(BigDecimal montant, ModePaiement modePaiement, String reference,
                             Long membreId, String objetType, Long objetId) {
        verifierObjet(objetType, objetId);
        boolean aConfirmer = montant.compareTo(settingsService.seuilConfirmation()) > 0;
        if (!aConfirmer) {
            verifierSolde(montant);
        }
        var op = Operation.builder()
                .dateOp(OffsetDateTime.now())
                .montant(montant)
                .sens(SensOp.SORTIE)
                .typeOp(TypeOperation.DEPENSE)
                .modePaiement(modePaiement)
                .reference(reference)
                .statut(aConfirmer ? OpStatut.EN_ATTENTE_CONFIRMATION : OpStatut.ENREGISTREE)
                .membreId(membreId)
                .objetType(objetType)
                .objetId(objetId)
                .build();
        var saved = repo.save(op);
        repo.flush();
        if (aConfirmer) {
            notifications.sansRisque(() -> notifications.informerRoles(java.util.Set.of(com.madsi.backend.membres.RoleMembre.ADMIN),
                    NotifType.ALERTE, "Dépense à confirmer par le président",
                    "Une dépense de " + fcfa(montant) + " (au-dessus de " + fcfa(settingsService.seuilConfirmation())
                            + ") attend votre confirmation dans Opérations.", TopicType.AUTRE, saved.getId(), true));
        }
        histo.enregistrer(membreId,
                aConfirmer ? "Dépense en attente de confirmation du président" : "Opération SORTIE",
                "type=DEPENSE, montant=%s, objet=%s/%s".formatted(montant, objetType, objetId),
                HistoType.SYSTEME, objetType, objetId);
        return saved;
    }

    /** Une dépense rattachée à une prestation ou une activité doit viser une manifestation existante, ni en attente ni annulée. */
    private void verifierObjet(String objetType, Long objetId) {
        if (!"manifestation".equals(objetType)) return;
        if (objetId == null) throw new IllegalArgumentException("Précisez la prestation ou l'activité concernée.");
        var m = manifRepo.findById(objetId)
                .orElseThrow(() -> new IllegalArgumentException("Prestation ou activité introuvable."));
        if (m.getStatut() != ManifStatut.PLANIFIEE && m.getStatut() != ManifStatut.REALISEE) {
            throw new IllegalStateException("On ne peut payer que des activités validées (planifiées ou réalisées) ; celle-ci est « "
                    + m.getStatut() + " ».");
        }
    }

    /** Confirmation d'une dépense par le président (administrateur). */
    @Transactional
    public Operation confirmerDepense(Long operationId, Long presidentId) {
        var op = repo.findById(operationId).orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Opération introuvable"));
        if (op.getStatut() != OpStatut.EN_ATTENTE_CONFIRMATION) {
            throw new IllegalStateException("Cette opération n'est pas en attente de confirmation.");
        }
        verifierSolde(op.getMontant());
        op.setStatut(OpStatut.ENREGISTREE);
        op.setDateOp(OffsetDateTime.now()); // la dépense entre en caisse à la date de confirmation
        var saved = repo.save(op);
        notifications.sansRisque(() -> notifications.informerRoles(java.util.Set.of(com.madsi.backend.membres.RoleMembre.TRESORIER),
                NotifType.INFO, "Dépense confirmée par le président",
                "La dépense de " + fcfa(saved.getMontant()) + " est confirmée et enregistrée en caisse.", TopicType.AUTRE, saved.getId(), true));
        histo.enregistrer(saved.getMembreId(), "Dépense confirmée par le président",
                "opId=%d, montant=%s, par userId=%d".formatted(operationId, saved.getMontant(), presidentId),
                HistoType.SYSTEME, saved.getObjetType(), saved.getObjetId());
        return saved;
    }

    /** Refus d'une dépense par le président (administrateur). */
    @Transactional
    public Operation refuserDepense(Long operationId, Long presidentId, String motif) {
        var op = repo.findById(operationId).orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Opération introuvable"));
        if (op.getStatut() != OpStatut.EN_ATTENTE_CONFIRMATION) {
            throw new IllegalStateException("Cette opération n'est pas en attente de confirmation.");
        }
        if (motif == null || motif.isBlank()) {
            throw new IllegalArgumentException("Le motif du refus est obligatoire.");
        }
        op.setStatut(OpStatut.ANNULEE);
        var saved = repo.save(op);
        notifications.sansRisque(() -> notifications.informerRoles(java.util.Set.of(com.madsi.backend.membres.RoleMembre.TRESORIER),
                NotifType.ALERTE, "Dépense refusée par le président",
                "La dépense de " + fcfa(saved.getMontant()) + " est refusée.\n\nMotif : " + motif, TopicType.AUTRE, saved.getId(), true));
        histo.enregistrer(saved.getMembreId(), "Dépense refusée par le président",
                "opId=%d, motif=%s, par userId=%d".formatted(operationId, motif, presidentId),
                HistoType.SYSTEME, saved.getObjetType(), saved.getObjetId());
        return saved;
    }

    /** Solde actuel de la caisse (entrées - sorties des opérations enregistrées, annulées et en attente exclues). */
    public BigDecimal soldeActuel() {
        return repo.soldeBetween(java.time.LocalDate.of(1900, 1, 1), java.time.LocalDate.now().plusDays(1));
    }

    public Operation credit(TypeOperation typeOp, BigDecimal montant, ModePaiement modePaiement,
                            String reference, Long membreId, String objetType, Long objetId) {
        var op = Operation.builder()
                .dateOp(OffsetDateTime.now())
                .montant(montant)
                .sens(SensOp.ENTREE)
                .typeOp(typeOp)
                .modePaiement(modePaiement)
                .reference(reference)
                .statut(OpStatut.ENREGISTREE)
                .membreId(membreId)
                .objetType(objetType)
                .objetId(objetId)
                .build();
        var saved = repo.save(op);
        repo.flush(); // Force la persistance pour obtenir l'ID

        // Enregistrer dans l'historique (non-bloquant pour éviter les rollbacks)
        try {
            histo.enregistrer(
                    membreId,
                    "Opération ENTREE",
                    "type=%s, montant=%s, objet=%s/%s".formatted(typeOp, montant, objetType, objetId),
                    HistoType.SYSTEME,                   // ✅ SYSTEME (pas CAISSE)
                    objetType, objetId
            );
        } catch (Exception e) {
            // Log l'erreur mais continue - l'historique n'est pas critique pour l'opération
            System.err.println("Erreur lors de l'enregistrement dans l'historique (non bloquant): " + e.getMessage());
            e.printStackTrace();
        }
        
        return saved;
    }

    public Operation debit(TypeOperation typeOp, BigDecimal montant, ModePaiement modePaiement,
                           String reference, Long membreId, String objetType, Long objetId) {
        var op = Operation.builder()
                .dateOp(OffsetDateTime.now())
                .montant(montant)
                .sens(SensOp.SORTIE)
                .typeOp(typeOp)
                .modePaiement(modePaiement)
                .reference(reference)
                .statut(OpStatut.ENREGISTREE)
                .membreId(membreId)
                .objetType(objetType)
                .objetId(objetId)
                .build();
        var saved = repo.save(op);
        repo.flush(); // Force la persistance pour obtenir l'ID

        // Enregistrer dans l'historique (non-bloquant pour éviter les rollbacks)
        try {
            histo.enregistrer(
                    membreId,
                    "Opération SORTIE",
                    "type=%s, montant=%s, objet=%s/%s".formatted(typeOp, montant, objetType, objetId),
                    HistoType.SYSTEME,                   // ✅ SYSTEME (pas CAISSE)
                    objetType, objetId
            );
        } catch (Exception e) {
            // Log l'erreur mais continue - l'historique n'est pas critique pour l'opération
            System.err.println("Erreur lors de l'enregistrement dans l'historique (non bloquant): " + e.getMessage());
            e.printStackTrace();
        }
        
        return saved;
    }

    @Transactional
    public Operation annuler(Long operationId, String motif) {
        var op = repo.findById(operationId)
                .orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Opération introuvable"));
        if (op.getStatut() == OpStatut.ANNULEE) {
            throw new IllegalStateException("Cette opération est déjà annulée.");
        }
        var fin = settingsService.get().getFinance();
        boolean motifObligatoire = fin == null || fin.getMotifAnnulationObligatoire() == null || fin.getMotifAnnulationObligatoire();
        if (motifObligatoire && (motif == null || motif.isBlank())) {
            throw new IllegalArgumentException("Le motif d'annulation est obligatoire.");
        }
        // Les opérations liées à une adhésion ou à un prêt suivent leur propre circuit : on ne les annule pas ici
        if ("adhesion".equals(op.getObjetType())) {
            throw new IllegalStateException("Le paiement d'une adhésion validée ne peut pas être annulé ici.");
        }
        if ("pret".equals(op.getObjetType()) || "remboursement".equals(op.getObjetType())) {
            throw new IllegalStateException("Cette opération est liée à un prêt : elle ne peut pas être annulée directement.");
        }
        // Une cotisation dont l'encaissement est annulé redevient impayée (sinon elle resterait comptée comme payée)
        if ("cotisation".equals(op.getObjetType()) && op.getObjetId() != null) {
            cotisationRepo.findById(op.getObjetId()).ifPresent(c -> {
                c.setStatut(com.madsi.backend.common.Enums.CotiStatut.REJETE);
                String note = "Annulée : " + (motif == null ? "-" : motif);
                c.setRemarque(c.getRemarque() == null || c.getRemarque().isBlank() ? note : c.getRemarque() + " | " + note);
                cotisationRepo.save(c);
            });
        }
        op.setStatut(OpStatut.ANNULEE);
        var saved = repo.save(op);

        histo.enregistrer(
                saved.getMembreId(),
                "Annulation opération",
                "opId=%d, motif=%s".formatted(operationId, motif == null ? "-" : motif),
                HistoType.SYSTEME,                   // ✅ SYSTEME (pas CAISSE)
                saved.getObjetType(), saved.getObjetId()
        );
        return saved;
    }

    // --------- Recherche (journal) ----------
    public Page<Operation> search(
            String q,
            SensOp sens,
            TypeOperation typeOp,
            ModePaiement mode,
            OpStatut statut,
            String dateFrom, // YYYY-MM-DD
            String dateTo,   // YYYY-MM-DD
            Pageable pageable
    ){
        // ✅ évite Specification.where(...) déprécié
        Specification<Operation> spec = (root, cq, cb) -> cb.conjunction();

        if (q != null && !q.isBlank()){
            var like = "%" + q.trim().toLowerCase() + "%";
            spec = spec.and((root, cq, cb) -> cb.or(
                    cb.like(cb.lower(root.get("reference")), like),
                    cb.like(cb.lower(root.get("objetType")), like),
                    cb.like(cb.lower(root.get("typeOp").as(String.class)), like)
            ));
        }
        if (sens != null){
            spec = spec.and((r, cq, cb) -> cb.equal(r.get("sens"), sens));
        }
        if (typeOp != null){
            spec = spec.and((r, cq, cb) -> cb.equal(r.get("typeOp"), typeOp));
        }
        if (mode != null){
            spec = spec.and((r, cq, cb) -> cb.equal(r.get("modePaiement"), mode));
        }
        if (statut != null){
            spec = spec.and((r, cq, cb) -> cb.equal(r.get("statut"), statut));
        }
        if (dateFrom != null && !dateFrom.isBlank()){
            var from = LocalDate.parse(dateFrom).atStartOfDay().atOffset(ZoneOffset.UTC);
            spec = spec.and((r, cq, cb) -> cb.greaterThanOrEqualTo(r.get("dateOp"), from));
        }
        if (dateTo != null && !dateTo.isBlank()){
            var to = LocalDate.parse(dateTo).plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
            spec = spec.and((r, cq, cb) -> cb.lessThan(r.get("dateOp"), to));
        }

        return repo.findAll(spec, pageable);    // ✅ OK après patch du Repository (voir B)
    }
}