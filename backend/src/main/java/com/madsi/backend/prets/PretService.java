package com.madsi.backend.prets;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.madsi.backend.common.Enums.*;
import com.madsi.backend.common.Enums.EchStatut;
import com.madsi.backend.common.Enums.HistoType;
import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.Enums.ObjetRecu;
import com.madsi.backend.common.Enums.PretStatut;
import com.madsi.backend.common.Enums.TypeOperation;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.operations.Operation;
import com.madsi.backend.operations.OperationService;
import com.madsi.backend.operations.ReceiptService;
import com.madsi.backend.operations.Recu;
import com.madsi.backend.prets.dto.PretDTO;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PretService {

    private final PretRepository pretRepo;
    private final EcheanceRepository echRepo;
    private final OperationService opService;
    private final ReceiptService receiptService;
    private final HistoriqueService histo;
    private final MembreRepository membreRepo;
    private final com.madsi.backend.membres.EligibiliteService eligibilite;
    private final com.madsi.backend.settings.SettingsService settingsService;
    private final com.madsi.backend.notifications.NotificationService notifications;

    private static final BigDecimal MONTANT_MAX_PAR_PRET = new BigDecimal("100000000");
    private static final int DUREE_MAX = 60;

    private static String fcfa(BigDecimal v) {
        return java.text.NumberFormat.getIntegerInstance(java.util.Locale.FRANCE).format(v) + " FCFA";
    }

    /** Ce que le membre doit encore sur ses prêts non clôturés (demandés, approuvés ou en cours). */
    private BigDecimal encoursRestant(Long membreId) {
        BigDecimal total = BigDecimal.ZERO;
        for (Pret x : pretRepo.findByMembreIdOrderByIdDesc(membreId)) {
            if (x.getStatut() == PretStatut.DEMANDE || x.getStatut() == PretStatut.APPROUVE || x.getStatut() == PretStatut.EN_COURS) {
                BigDecimal rembourse = x.getMontantRembourse() == null ? BigDecimal.ZERO : x.getMontantRembourse();
                BigDecimal reste = x.getMontantAccorde().subtract(rembourse);
                if (reste.signum() > 0) total = total.add(reste);
            }
        }
        return total;
    }

    private boolean depasseSeuil(Pret p) {
        return p.getMontantAccorde().compareTo(settingsService.seuilConfirmation()) > 0;
    }

    // ---------- Demande ----------
    public Pret demander(Long membreId, BigDecimal montant, Integer dureeMois, String periodeUniteStr, String motif){
        // Vérifier que le membre existe
        Membre membre = membreRepo.findById(membreId)
                .orElseThrow(() -> new NotFoundException("Membre introuvable avec l'ID: " + membreId));

        // --- Règles d'attribution (statuts art. 3 et règlement intérieur art. 11 et 18) ---
        if (montant == null || montant.signum() <= 0) {
            throw new IllegalArgumentException("Le montant du prêt doit être supérieur à 0.");
        }
        if (montant.compareTo(MONTANT_MAX_PAR_PRET) > 0) {
            throw new IllegalArgumentException("Montant du prêt invalide.");
        }
        if (dureeMois == null || dureeMois < 1 || dureeMois > DUREE_MAX) {
            throw new IllegalArgumentException("La durée doit être comprise entre 1 et " + DUREE_MAX + " échéances.");
        }
        if (membre.getEtatCompte() != com.madsi.backend.common.Enums.EtatCompte.ACTIF) {
            throw new IllegalStateException("Seul un membre actif peut demander un prêt.");
        }
        // 1) à jour des cotisations
        eligibilite.exigerAJour(membreId, "un prêt");
        // 2) plafond d'encours : ce qu'il doit encore + le nouveau prêt ne doit pas dépasser le plafond
        BigDecimal encours = encoursRestant(membreId);
        BigDecimal plafond = settingsService.plafondEncoursPrets();
        if (encours.signum() > 0 && encours.add(montant).compareTo(plafond) > 0) {
            throw new IllegalStateException("Vous avez déjà " + fcfa(encours) + " de prêts non remboursés. Un nouveau prêt de "
                    + fcfa(montant) + " porterait votre total à " + fcfa(encours.add(montant))
                    + ", au-delà du plafond de " + fcfa(plafond) + ". Remboursez d'abord vos prêts en cours.");
        }

        // Convertir l'unité de période (défaut: MOIS)
        PeriodeUnite periodeUnite = PeriodeUnite.MOIS;
        if (periodeUniteStr != null && !periodeUniteStr.isBlank()) {
            try {
                periodeUnite = PeriodeUnite.valueOf(periodeUniteStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                // Garder la valeur par défaut MOIS
            }
        }

        var p = Pret.builder()
                .membreId(membreId)
                .montantAccorde(montant)
                .dureeMois(dureeMois)
                .periodeUnite(periodeUnite)
                .motif(motif != null && !motif.isBlank() ? motif : null)
                .dateDemande(LocalDate.now())
                .montantRembourse(BigDecimal.ZERO)
                .statut(PretStatut.DEMANDE)
                .build();
        var saved = pretRepo.save(p);

        histo.enregistrer(
                membreId,
                "Demande de prêt",
                "pretId=%d, montant=%s, duree=%d %s, motif=%s".formatted(saved.getId(), saved.getMontantAccorde(), saved.getDureeMois(), periodeUnite, motif != null ? motif : "non spécifié"),
                HistoType.PRET,
                "pret", saved.getId()
        );
        notifications.sansRisque(() -> {
            String nom = notifications.nomDe(membreId);
            notifications.informerRoles(java.util.Set.of(com.madsi.backend.membres.RoleMembre.TRESORIER), NotifType.INFO,
                    "Nouvelle demande de prêt",
                    nom + " demande un prêt de " + fcfa(saved.getMontantAccorde()) + " sur " + saved.getDureeMois() + " échéance(s).",
                    TopicType.PRET, saved.getId(), true);
            if (depasseSeuil(saved)) {
                notifications.informerRoles(java.util.Set.of(com.madsi.backend.membres.RoleMembre.ADMIN), NotifType.ALERTE,
                        "Prêt à confirmer par le président",
                        "Le prêt de " + fcfa(saved.getMontantAccorde()) + " demandé par " + nom + " dépasse "
                                + fcfa(settingsService.seuilConfirmation()) + " : votre confirmation est nécessaire avant la validation par le trésorier.",
                        TopicType.PRET, saved.getId(), true);
            }
        });
        return saved;
    }

    // ---------- Validation / Refus ----------
    /**
     * Confirmation par le président (administrateur) : obligatoire avant la validation d'un prêt
     * dont le montant dépasse le seuil de confirmation (statuts : le président ordonne les dépenses).
     */
    @Transactional
    public Pret confirmer(Long pretId, Long presidentId){
        var p = pretRepo.findById(pretId).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        if (p.getStatut() != PretStatut.DEMANDE) {
            throw new IllegalStateException("Seul un prêt à l'étape « demande » peut être confirmé.");
        }
        if (!depasseSeuil(p)) {
            throw new IllegalStateException("Ce prêt ne dépasse pas " + fcfa(settingsService.seuilConfirmation())
                    + " : aucune confirmation du président n'est nécessaire.");
        }
        p.setConfirmePar(presidentId);
        p.setDateConfirmation(LocalDate.now());
        var saved = pretRepo.save(p);
        histo.enregistrer(saved.getMembreId(), "Confirmation du prêt par le président",
                "pretId=%d, montant=%s, par userId=%d".formatted(saved.getId(), saved.getMontantAccorde(), presidentId),
                HistoType.PRET, "pret", saved.getId());
        notifications.sansRisque(() -> notifications.informerRoles(java.util.Set.of(com.madsi.backend.membres.RoleMembre.TRESORIER),
                NotifType.INFO, "Prêt confirmé par le président",
                "Le prêt de " + fcfa(saved.getMontantAccorde()) + " demandé par " + notifications.nomDe(saved.getMembreId())
                        + " est confirmé : vous pouvez le valider.", TopicType.PRET, saved.getId(), true));
        return saved;
    }

    /**
     * Refus par le président (administrateur) : possible seulement pour un prêt au-dessus du seuil de confirmation,
     * encore à l'étape « demande » et non confirmé. Le prêt passe à « refusé » et le demandeur est prévenu.
     */
    @Transactional
    public Pret refuserParPresident(Long pretId, Long presidentId, String motif){
        var p = pretRepo.findById(pretId).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        if (p.getStatut() != PretStatut.DEMANDE) {
            throw new IllegalStateException("Seul un prêt à l'étape « demande » peut être refusé.");
        }
        if (!depasseSeuil(p)) {
            throw new IllegalStateException("Ce prêt ne dépasse pas " + fcfa(settingsService.seuilConfirmation())
                    + " : le refus relève du trésorier.");
        }
        if (p.getConfirmePar() != null) {
            throw new IllegalStateException("Ce prêt est déjà confirmé par le président : le trésorier ne peut plus que le valider ou le refuser.");
        }
        histo.enregistrer(p.getMembreId(), "Refus du prêt par le président",
                "pretId=%d, par userId=%d".formatted(p.getId(), presidentId), HistoType.PRET, "pret", p.getId());
        return refuser(pretId, motif);
    }

    public Pret valider(Long pretId, Long acteurId){
        var p = pretRepo.findById(pretId).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        if (p.getStatut() != PretStatut.DEMANDE) {
            throw new IllegalStateException("Seul un prêt à l'étape « demande » peut être validé (statut actuel : " + p.getStatut() + ").");
        }
        if (acteurId != null && acteurId.equals(p.getMembreId())) {
            throw new IllegalStateException("Vous ne pouvez pas valider votre propre prêt : un autre trésorier doit le faire.");
        }
        if (depasseSeuil(p) && p.getConfirmePar() == null) {
            throw new IllegalStateException("Ce prêt dépasse " + fcfa(settingsService.seuilConfirmation())
                    + " : le président (administrateur) doit d'abord le confirmer.");
        }
        p.setStatut(PretStatut.APPROUVE);
        p.setDateValidation(LocalDate.now());
        var saved = pretRepo.save(p);

        histo.enregistrer(
                saved.getMembreId(),
                "Validation de prêt",
                "pretId=%d".formatted(saved.getId()),
                HistoType.PRET,
                "pret", saved.getId()
        );
        notifications.sansRisque(() -> notifications.informer(saved.getMembreId(), NotifType.INFO, "Votre prêt est approuvé",
                "Votre demande de prêt de " + fcfa(saved.getMontantAccorde()) + " est approuvée. Le trésorier vous remettra la somme ; "
                        + "vous recevrez ensuite le calendrier de remboursement.", TopicType.PRET, saved.getId(), true));
        return saved;
    }

    public Pret refuser(Long pretId, String motifRejet){
        var p = pretRepo.findById(pretId).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
        if (p.getStatut() != PretStatut.DEMANDE) {
            throw new IllegalStateException("Seul un prêt à l'étape « demande » peut être refusé (statut actuel : " + p.getStatut() + ").");
        }
        p.setStatut(PretStatut.REFUSE);
        if (motifRejet != null && !motifRejet.isBlank()) {
            p.setMotifRejet(motifRejet);
        }
        var saved = pretRepo.save(p);

        histo.enregistrer(
                saved.getMembreId(),
                "Refus de prêt",
                "pretId=%d, motif=%s".formatted(saved.getId(), motifRejet != null ? motifRejet : "non spécifié"),
                HistoType.PRET,
                "pret", saved.getId()
        );
        notifications.sansRisque(() -> notifications.informer(saved.getMembreId(), NotifType.ALERTE, "Votre demande de prêt est refusée",
                "Votre demande de prêt de " + fcfa(saved.getMontantAccorde()) + " n'a pas été acceptée."
                        + (motifRejet != null && !motifRejet.isBlank() ? "\n\nMotif : " + motifRejet : ""),
                TopicType.PRET, saved.getId(), true));
        return saved;
    }

    // ---------- Versement (décaissement + reçu + échéancier) ----------
    @Transactional
    public VerserAck verser(Long pretId, Long acteurId, ModePaiement mode, String reference, LocalDate dateDecaissement, String photoPreuve){
        var p = pretRepo.findById(pretId).orElseThrow(() -> new NotFoundException("Prêt introuvable"));

        // Garde-fous
        if (p.getDateDecaissement() != null || p.getStatut() == PretStatut.EN_COURS || p.getStatut() == PretStatut.CLOTURE) {
            throw new IllegalStateException("Le prêt est déjà décaissé ou en cours/clôturé.");
        }
        if (p.getStatut() != PretStatut.APPROUVE){
            throw new IllegalStateException("Le prêt doit être APPROUVE avant le versement.");
        }

        if (acteurId != null && acteurId.equals(p.getMembreId())) {
            throw new IllegalStateException("Vous ne pouvez pas verser votre propre prêt : un autre trésorier doit le faire.");
        }
        // Les prêts sont accordés « en fonction des ressources disponibles » (statuts, art. 3)
        BigDecimal solde = opService.soldeActuel();
        if (solde.compareTo(p.getMontantAccorde()) < 0) {
            throw new IllegalStateException("Solde de caisse insuffisant : " + fcfa(solde) + " disponibles pour un prêt de "
                    + fcfa(p.getMontantAccorde()) + ".");
        }

        // 1) Opération de SORTIE (journal caisse)
        Operation op = opService.debit(
                TypeOperation.DEPENSE,
                p.getMontantAccorde(),
                mode, reference,
                p.getMembreId(),
                "pret", p.getId()
        );

        // 2) Reçu (décaissement)
        Recu recu = receiptService.generate(op, ObjetRecu.DEPENSE, p.getMontantAccorde(), mode, reference);

        // 3) Échéancier
        var d = (dateDecaissement != null ? dateDecaissement : LocalDate.now());
        genEcheancier(p, d);

        // 4) Passer EN_COURS + sauvegarder la preuve
        p.setDateDecaissement(d);
        p.setStatut(PretStatut.EN_COURS);
        if (photoPreuve != null && !photoPreuve.isBlank()) {
            p.setPhotoPreuve(photoPreuve);
        }
        var saved = pretRepo.save(p);

        // Historisation
        histo.enregistrer(
                saved.getMembreId(),
                "Décaissement du prêt",
                "pretId=%d, montant=%s, mode=%s, ref=%s".formatted(saved.getId(), saved.getMontantAccorde(), mode, reference),
                HistoType.PRET,
                "pret", saved.getId()
        );

        notifications.sansRisque(() -> notifications.informer(saved.getMembreId(), NotifType.INFO, "Prêt versé",
                "Le prêt de " + fcfa(saved.getMontantAccorde()) + " vous a été versé. Il se rembourse en " + saved.getDureeMois()
                        + " échéance(s) ; consultez le calendrier dans l'application, rubrique Prêts. Un reçu est disponible.",
                TopicType.PRET, saved.getId(), true));

        // 5) ACK (pour ouvrir le PDF côté front)
        return new VerserAck(saved, op.getId(), recu.getId(), recu.getFichierPdfUrl());
    }

    /** Génère N échéances égales selon l'unité de période (jour/semaine/mois), purge si existantes. */
    private void genEcheancier(Pret p, LocalDate start){
        // Purge des échéances existantes (utilise une requête bulk au lieu de boucle)
        echRepo.deleteByPretId(p.getId());
        echRepo.flush(); // S'assurer que la suppression est commitée avant l'insertion

        BigDecimal total = p.getMontantAccorde();
        int n = p.getDureeMois();
        BigDecimal part = total.divide(BigDecimal.valueOf(n), 2, java.math.RoundingMode.HALF_UP);

        // Déterminer l'unité de période (défaut: MOIS)
        PeriodeUnite unite = p.getPeriodeUnite() != null ? p.getPeriodeUnite() : PeriodeUnite.MOIS;

        List<Echeance> list = new ArrayList<>();
        for (int i = 1; i <= n; i++){
            LocalDate due;
            switch (unite) {
                case JOUR:
                    due = start.plusDays(i);
                    break;
                case SEMAINE:
                    due = start.plusWeeks(i);
                    break;
                case MOIS:
                default:
                    due = start.plusMonths(i);
                    break;
            }
            // La dernière échéance absorbe l'arrondi : la somme des échéances est exactement le montant accordé
            BigDecimal montantEch = (i == n) ? total.subtract(part.multiply(BigDecimal.valueOf(n - 1L))) : part;
            list.add(Echeance.builder()
                    .pretId(p.getId())
                    .numero(i)
                    .dateEcheance(due)
                    .montantDu(montantEch)
                    .statut(EchStatut.EN_ATTENTE)
                    .build());
        }
        echRepo.saveAll(list);
        echRepo.flush(); // S'assurer que les insertions sont commitées
    }

    // ---------- Consultation ----------
    public List<Pret> listByMembre(Long membreId){
        return pretRepo.findByMembreIdOrderByIdDesc(membreId);
    }

    public Pret get(Long id){
        return pretRepo.findById(id).orElseThrow(() -> new NotFoundException("Prêt introuvable"));
    }

    public List<Echeance> schedule(Long pretId){
        return echRepo.findByPretIdOrderByNumeroAsc(pretId);
    }

    // ---------- Clôture automatique si toutes payées ----------
    public void tryCloture(Long pretId){
        long rest = echRepo.countByPretIdAndStatutNot(pretId, EchStatut.PAYE);
        if (rest == 0){
            var p = pretRepo.findById(pretId).orElseThrow();
            p.setStatut(PretStatut.CLOTURE);
            var saved = pretRepo.save(p);

            histo.enregistrer(
                    saved.getMembreId(),
                    "Clôture du prêt",
                    "pretId=%d".formatted(saved.getId()),
                    HistoType.PRET,
                    "pret", saved.getId()
            );
        }
    }

    // Cumul remboursé (incrémental)
    public void updateMontantRembourse(Long pretId, BigDecimal delta){
        var p = pretRepo.findById(pretId).orElseThrow();
        p.setMontantRembourse(p.getMontantRembourse().add(delta));
        pretRepo.save(p);
    }

    // ---------- Mapping vers DTO ----------
    public PretDTO toDTO(Pret pret) {
        Membre membre = membreRepo.findById(pret.getMembreId()).orElse(null);
        String membreNom = membre != null ? membre.getLastName() : "";
        String membrePrenom = membre != null ? membre.getFirstName() : "";
        
        BigDecimal montantRestant = pret.getMontantAccorde().subtract(pret.getMontantRembourse());
        if (montantRestant.compareTo(BigDecimal.ZERO) < 0) {
            montantRestant = BigDecimal.ZERO;
        }
        
        return new PretDTO(
                pret.getId(),
                pret.getMembreId(),
                membreNom,
                membrePrenom,
                pret.getMontantAccorde(),
                pret.getDureeMois(),
                pret.getPeriodeUnite() != null ? pret.getPeriodeUnite().name() : "MOIS",
                pret.getDateDemande(),
                pret.getDateValidation(),
                pret.getDateDecaissement(),
                pret.getMontantRembourse(),
                montantRestant,
                pret.getStatut().name(),
                pret.getMotif(),
                pret.getMotifRejet(),
                pret.getPhotoPreuve(),
                pret.getStatut() == PretStatut.DEMANDE && depasseSeuil(pret) && pret.getConfirmePar() == null,
                pret.getConfirmePar() != null,
                (pret.getStatut() == PretStatut.DEMANDE || pret.getStatut() == PretStatut.APPROUVE)
                        ? eligibilite.nombreMoisImpayes(pret.getMembreId()) : null
        );
    }

    public List<PretDTO> toDTOList(List<Pret> prets) {
        return prets.stream().map(this::toDTO).collect(Collectors.toList());
    }
}