package com.madsi.backend.prets;

import com.madsi.backend.common.Enums.*;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.notifications.NotificationService;
import com.madsi.backend.operations.Operation;
import com.madsi.backend.operations.OperationService;
import com.madsi.backend.operations.ReceiptService;
import com.madsi.backend.operations.Recu;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RemboursementService {

    private final RemboursementRepository rembRepo;
    private final EcheanceRepository echRepo;
    private final PretRepository pretRepo;
    private final OperationService opService;
    private final ReceiptService receiptService;
    private final PretService pretService;
    private final HistoriqueService histo;
    private final NotificationService notifService; // ✅ notifications

    // ---------- règles communes ----------

    private static String fcfa(BigDecimal v) {
        return java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRANCE).format(v) + " FCFA";
    }

    /** Ce qu'il reste à payer sur l'échéance (paiements enregistrés uniquement). */
    private BigDecimal resteDu(Echeance e) {
        BigDecimal paye = rembRepo.sumByEcheance(e.getId());
        BigDecimal reste = e.getMontantDu().subtract(paye == null ? BigDecimal.ZERO : paye);
        return reste.signum() < 0 ? BigDecimal.ZERO : reste;
    }

    /** Un paiement n'est possible que sur un prêt en cours, une échéance non soldée, et dans la limite du reste dû. */
    private void verifierPaiement(Echeance e, Pret p, BigDecimal montant) {
        if (montant == null || montant.signum() <= 0) {
            throw new IllegalArgumentException("Le montant doit être supérieur à 0.");
        }
        if (p.getStatut() != PretStatut.EN_COURS) {
            throw new IllegalStateException("Ce prêt n'est pas en cours de remboursement (statut : " + p.getStatut() + ").");
        }
        BigDecimal reste = resteDu(e);
        if (e.getStatut() == EchStatut.PAYE || reste.signum() == 0) {
            throw new IllegalStateException("Cette échéance est déjà entièrement payée.");
        }
        if (montant.compareTo(reste) > 0) {
            throw new IllegalStateException("Le montant (" + fcfa(montant) + ") dépasse le reste dû de cette échéance ("
                    + fcfa(reste) + ").");
        }
    }

    /** A) Encaissement espèces (guichet) : opération + reçu + notif + histo */
    @Transactional
    public RemboursementAck enregistrer(Long echeanceId, BigDecimal montant, ModePaiement mode, String reference){
        if (echeanceId == null) throw new IllegalArgumentException("echeanceId requis");
        if (montant == null || montant.signum() <= 0) throw new IllegalArgumentException("montant doit être > 0");
        if (mode == null) throw new IllegalArgumentException("modePaiement requis");

        var e = echRepo.findById(echeanceId).orElseThrow(() -> new NotFoundException("Échéance introuvable"));
        var p = pretRepo.findById(e.getPretId()).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        verifierPaiement(e, p, montant);

        // 1) Opération ENTREE
        Operation op = opService.credit(
                TypeOperation.REMBOURSEMENT_PRET, montant, mode, reference,
                p.getMembreId(), "remboursement", e.getId()
        );

        // 2) Reçu
        Recu recu = receiptService.generate(op, ObjetRecu.REMBOURSEMENT_PRET, montant, mode, reference);

        // 3) Trace remboursement
        var r = RemboursementPret.builder()
                .echeanceId(echeanceId)
                .datePaiement(LocalDate.now())
                .modePaiement(mode)
                .statut(RemStatut.ENREGISTRE)
                .operationId(op.getId())
                .montant(montant)
                .reference(reference)
                .build();
        r = rembRepo.save(r);

        // 4) Statuts (échéance + prêt)
        updateStatutsAfterPayment(e, p, montant);

        // 5) Historisation
        histo.enregistrer(
                p.getMembreId(),
                "Remboursement prêt (espèces)",
                "pretId=%d, echeanceId=%d, montant=%s, mode=%s, ref=%s".formatted(p.getId(), e.getId(), montant, mode, reference),
                HistoType.PRET,
                "remboursement", r.getId()
        );

        // 6) Notification au membre (INFO/CLASSIC) avec lien reçu
        sendInfoNotifRemboursement(p.getMembreId(), e.getId(), recu.getFichierPdfUrl(), montant);

        return new RemboursementAck(r.getId(), op.getId(), recu.getId(), recu.getNumero(), recu.getFichierPdfUrl());
    }

    /** B1) Membre soumet une preuve mobile (EN_ATTENTE) */
    @Transactional
    public RemboursementPret submitMobileProof(Long echeanceId, BigDecimal montant, String reference, String preuveUrl){
        var e = echRepo.findById(echeanceId).orElseThrow(() -> new NotFoundException("Échéance introuvable"));
        var p = pretRepo.findById(e.getPretId()).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        verifierPaiement(e, p, montant);
        if (reference == null || reference.isBlank()) {
            throw new IllegalArgumentException("La référence de la transaction est obligatoire.");
        }
        if (!rembRepo.findByEcheanceIdAndStatut(echeanceId, RemStatut.EN_ATTENTE).isEmpty()) {
            throw new IllegalStateException("Une preuve de paiement est déjà en attente de validation pour cette échéance.");
        }

        var r = RemboursementPret.builder()
                .echeanceId(echeanceId)
                .datePaiement(LocalDate.now())
                .modePaiement(ModePaiement.MOBILE_MONEY)
                .statut(RemStatut.EN_ATTENTE)
                .montant(montant)
                .reference(reference)
                .preuveUrl(preuveUrl)
                .build();
        r = rembRepo.save(r);

        histo.enregistrer(
                p.getMembreId(),
                "Soumission remboursement mobile (en attente)",
                "pretId=%d, echeanceId=%d, montant=%s, ref=%s".formatted(p.getId(), e.getId(), montant, reference),
                HistoType.PRET,
                "remboursement", r.getId()
        );

        // Optionnel: notif d'accusé de réception
        notifService.envoyer(
                NotifType.INFO, p.getMembreId(), Canal.EMAIL,
                "Remboursement en attente de validation",
                "Votre remboursement mobile a été soumis et attend validation de la trésorerie.",
                TopicType.ECHEANCE, e.getId()
        );

        return r;
    }

    /** B2) Trésorière valide une preuve mobile => crée opération + reçu + bascule ENREGISTRE + notif */
    @Transactional
    public RemboursementAck validerMobile(Long rembId, Long acteurId){
        var r = rembRepo.findById(rembId).orElseThrow(() -> new NotFoundException("Remboursement introuvable"));
        if (r.getStatut() != RemStatut.EN_ATTENTE) throw new IllegalStateException("Le remboursement n'est pas en attente");

        var e = echRepo.findById(r.getEcheanceId()).orElseThrow(() -> new NotFoundException("Échéance introuvable"));
        var p = pretRepo.findById(e.getPretId()).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        if (acteurId != null && acteurId.equals(p.getMembreId())) {
            throw new IllegalStateException("Vous ne pouvez pas valider votre propre remboursement : un autre trésorier doit le faire.");
        }
        verifierPaiement(e, p, r.getMontant());

        // 1) Opération ENTREE
        Operation op = opService.credit(
                TypeOperation.REMBOURSEMENT_PRET, r.getMontant(),
                ModePaiement.MOBILE_MONEY, r.getReference(),
                p.getMembreId(), "remboursement", e.getId()
        );

        // 2) Reçu
        Recu recu = receiptService.generate(op, ObjetRecu.REMBOURSEMENT_PRET, r.getMontant(), ModePaiement.MOBILE_MONEY, r.getReference());

        // 3) Mettre à jour le remboursement
        r.setOperationId(op.getId());
        r.setStatut(RemStatut.ENREGISTRE);
        rembRepo.save(r);

        // 4) Statuts (échéance + prêt)
        updateStatutsAfterPayment(e, p, r.getMontant());

        // 5) Historisation
        histo.enregistrer(
                p.getMembreId(),
                "Validation remboursement mobile",
                "pretId=%d, echeanceId=%d, rembId=%d".formatted(p.getId(), e.getId(), r.getId()),
                HistoType.PRET,
                "remboursement", r.getId()
        );

        // 6) Notification “validé” avec lien reçu
        sendInfoNotifRemboursement(p.getMembreId(), e.getId(), recu.getFichierPdfUrl(), r.getMontant());

        return new RemboursementAck(r.getId(), op.getId(), recu.getId(), recu.getNumero(), recu.getFichierPdfUrl());
    }

    /** B3) Trésorière rejette la preuve => statut REJETE + notif */
    @Transactional
    public RemboursementPret rejeterMobile(Long rembId, String motif){
        var r = rembRepo.findById(rembId).orElseThrow(() -> new NotFoundException("Remboursement introuvable"));
        if (r.getStatut() != RemStatut.EN_ATTENTE) throw new IllegalStateException("Le remboursement n'est pas en attente");

        var e = echRepo.findById(r.getEcheanceId()).orElseThrow(() -> new NotFoundException("Échéance introuvable"));
        var p = pretRepo.findById(e.getPretId()).orElseThrow(() -> new NotFoundException("Prêt introuvable"));

        r.setStatut(RemStatut.REJETE);
        rembRepo.save(r);

        histo.enregistrer(
                p.getMembreId(),
                "Rejet remboursement mobile",
                "pretId=%d, echeanceId=%d, rembId=%d, motif=%s".formatted(p.getId(), e.getId(), r.getId(), String.valueOf(motif)),
                HistoType.PRET,
                "remboursement", r.getId()
        );

        // Notification de rejet
        notifService.envoyer(
                NotifType.INFO, p.getMembreId(), Canal.EMAIL,
                "Remboursement rejeté",
                "Votre remboursement mobile a été rejeté." + (motif!=null? " Motif : "+motif : ""),
                TopicType.ECHEANCE, e.getId()
        );

        return r;
    }

    /** C) Récupérer tous les remboursements en attente (pour le trésorier) */
    public List<RemboursementPret> getPending(){
        return rembRepo.findByStatutOrderByDatePaiementDesc(RemStatut.EN_ATTENTE);
    }

    // ---------- utilitaires ----------
    private void updateStatutsAfterPayment(Echeance e, Pret p, BigDecimal montant){
        var cumule = rembRepo.sumByEcheance(e.getId());
        e.setStatut(cumule.compareTo(e.getMontantDu()) >= 0 ? EchStatut.PAYE : EchStatut.PARTIEL);
        echRepo.save(e);

        pretService.updateMontantRembourse(p.getId(), montant);
        pretService.tryCloture(p.getId()); // clôture si tout payé
    }

    private void sendInfoNotifRemboursement(Long membreId, Long echeanceId, String recuUrl, BigDecimal montant){
        var msg = "Votre remboursement de %, .0f FCFA a été enregistré.".formatted(montant).replace(" ", "");
        if (recuUrl != null && !recuUrl.isBlank()) {
            msg += " Reçu : " + recuUrl;
        }
        notifService.envoyer(
                NotifType.INFO, membreId, Canal.EMAIL,
                "Remboursement enregistré",
                msg,
                TopicType.ECHEANCE, echeanceId
        );
    }
}