package com.madsi.backend.cotisations;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.cotisations.dto.CotisationResponseDTO;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.operations.Operation;
import com.madsi.backend.operations.OperationRepository;
import com.madsi.backend.stats.StatsService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service pour la gestion des cotisations par les membres
 * Cotisation mensuelle obligatoire : 1000 FCFA/mois
 * Possibilité de payer pour plusieurs mois à la fois
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CotisationMembreService {

    private final CotisationRepository cotisationRepo;
    private final MembreRepository membreRepo;
    private final OperationRepository operationRepo;
    private final HistoriqueService historiqueService;
    private final StatsService statsService;
    private final com.madsi.backend.settings.SettingsService settingsService;
    private final com.madsi.backend.operations.ReceiptService receiptService;
    private final com.madsi.backend.notifications.NotificationService notifications;

    private static final DateTimeFormatter PERIODE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");

    /**
     * Déclarer un paiement de cotisation par un membre
     * @param membreId ID du membre
     * @param moisDebut Mois de début (format: yyyy-MM)
     * @param nombreMois Nombre de mois à payer (1 à 12)
     * @param modePaiement Mode de paiement
     * @param reference Référence de transaction
     * @param remarque Remarque optionnelle
     * @param photoPreuve Chemin ou URL de la photo de preuve de paiement
     * @return Cotisation créée avec statut EN_ATTENTE
     */
    @Transactional
    public Cotisation declarer(Long membreId, String moisDebut, Integer nombreMois,
                               Enums.ModePaiement modePaiement, String reference, String remarque, String photoPreuve) {

        if (photoPreuve != null && photoPreuve.length() > 3_000_000) {
            throw new IllegalArgumentException("L'image jointe est trop volumineuse (2 Mo maximum).");
        }
        // Valider le format du mois de début
        validerFormatMoisDebut(moisDebut);

        // Vérifications
        var membre = membreRepo.findById(membreId)
                .orElseThrow(() -> new NotFoundException("Membre introuvable"));

        if (nombreMois == null || nombreMois < 1 || nombreMois > 12) {
            throw new IllegalArgumentException("Le nombre de mois doit être entre 1 et 12");
        }

        // Calculer les périodes et vérifier qu'elles ne sont pas déjà payées
        List<String> periodes = genererPeriodes(moisDebut, nombreMois);
        verifierPeriodesNonPayees(membreId, periodes);

        // Calculer le montant total
        BigDecimal montantTotal = settingsService.montantCotisation().multiply(new BigDecimal(nombreMois));

        // Créer la cotisation avec statut EN_ATTENTE
        Cotisation cotisation = Cotisation.builder()
                .membreId(membreId)
                .periodes(String.join(",", periodes))
                .nombreMois(nombreMois)
                .montant(montantTotal)
                .datePaiement(LocalDate.now())
                .modePaiement(modePaiement)
                .reference(reference)
                .remarque(remarque)
                .photoPreuve(photoPreuve)
                .statut(Enums.CotiStatut.EN_ATTENTE)
                .build();

        Cotisation saved;
        Long savedId;
        
        try {
            // Sauvegarder la cotisation
            saved = cotisationRepo.save(cotisation);
            
            // Forcer la persistance pour obtenir l'ID immédiatement
            cotisationRepo.flush();
            
            // Vérifier que l'ID a été généré
            if (saved.getId() == null) {
                throw new IllegalStateException("Erreur : l'ID de la cotisation n'a pas été généré après la sauvegarde");
            }
            
            // Stocker l'ID pour l'historique (avant toute autre opération)
            savedId = saved.getId();
            
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Si c'est une violation de contrainte unique
            String errorMsg = e.getMessage();
            log.warn("Violation de contrainte à la sauvegarde d'une cotisation : {}", errorMsg);
            if (errorMsg != null && (errorMsg.contains("membre_id") || errorMsg.contains("periode") || errorMsg.contains("unique"))) {
                throw new IllegalStateException(
                    "Une contrainte unique dans la base de données bloque la création. " +
                    "Veuillez exécuter le script SQL pour supprimer la contrainte unique. " +
                    "Erreur technique: " + errorMsg
                );
            }
            throw e;
        } catch (Exception e) {
            log.error("Erreur lors de la sauvegarde de la cotisation", e);
            throw new RuntimeException("Erreur lors de la sauvegarde de la cotisation: " + e.getMessage(), e);
        }
        
        // Enregistrer dans l'historique (non-bloquant) - APRÈS avoir sauvegardé avec succès
        try {
            historiqueService.enregistrer(
                    membreId,
                    "Déclaration cotisation",
                    String.format("Périodes: %s, Montant: %s FCFA, Mode: %s",
                        String.join(", ", periodes), montantTotal, modePaiement),
                    Enums.HistoType.COTISATION,
                    "cotisation",
                    savedId
            );
        } catch (Exception histoException) {
            // Log l'erreur mais continue - l'historique n'est pas critique
            log.warn("Historique de la déclaration non enregistré (non bloquant)", histoException);
            // Ne pas faire échouer la transaction à cause de l'historique
        }

        // Les trésoriers voient apparaître la déclaration dans leur cloche (sans email : il y en a beaucoup)
        notifications.sansRisque(() -> notifications.informerRoles(
                java.util.Set.of(com.madsi.backend.membres.RoleMembre.TRESORIER),
                Enums.NotifType.INFO, "Cotisation à valider",
                notifications.nomDe(membreId) + " a déclaré le paiement de " + montantTotal + " FCFA (" + String.join(", ", periodes) + ").",
                Enums.TopicType.COTISATION, savedId, false));

        return saved;
    }

    /**
     * Valider une cotisation par le trésorier
     * Crée l'opération comptable et met à jour la trésorerie
     */
    @Transactional
    public Cotisation valider(Long cotisationId, Long tresorierId) {
        var cotisation = cotisationRepo.findById(cotisationId)
                .orElseThrow(() -> new NotFoundException("Cotisation introuvable"));

        if (cotisation.getStatut() != Enums.CotiStatut.EN_ATTENTE) {
            throw new IllegalStateException("Seules les cotisations EN_ATTENTE peuvent être validées");
        }
        if (tresorierId != null && tresorierId.equals(cotisation.getMembreId())) {
            throw new IllegalStateException("Vous ne pouvez pas valider votre propre cotisation : un autre trésorier doit le faire.");
        }

        // Créer l'opération comptable (comme pour l'adhésion)
        // Utiliser la date actuelle (date de validation) pour que l'opération soit incluse dans les stats de l'année en cours
        Operation operation = Operation.builder()
                .membreId(cotisation.getMembreId())
                .montant(cotisation.getMontant())
                .dateOp(java.time.OffsetDateTime.now()) // Date de validation = date d'entrée dans la trésorerie
                .sens(Enums.SensOp.ENTREE)
                .typeOp(Enums.TypeOperation.COTISATION)
                .modePaiement(cotisation.getModePaiement())
                .reference(cotisation.getReference())
                .statut(Enums.OpStatut.ENREGISTREE)
                .objetType("cotisation")
                .objetId(cotisation.getId())
                .build();

        var savedOperation = operationRepo.save(operation);
        operationRepo.flush(); // Force la persistance

        // Reçu de versement (statuts, art. 20 : un reçu pour toute somme versée)
        receiptService.generate(savedOperation, Enums.ObjetRecu.COTISATION, cotisation.getMontant(),
                cotisation.getModePaiement(), cotisation.getReference(),
                cotisation.getPeriodes() == null ? null : "Périodes : " + cotisation.getPeriodes().replace(",", ", "));

        // Mettre à jour la cotisation
        cotisation.setStatut(Enums.CotiStatut.PAYE);
        cotisation.setValideParTresorier(tresorierId);
        cotisation.setDateValidation(LocalDate.now());
        cotisation.setOperationId(savedOperation.getId());

        var saved = cotisationRepo.save(cotisation);
        cotisationRepo.flush(); // Force la persistance

        // Note: Le reçu sera généré automatiquement si nécessaire via un autre service
        // Pour l'instant, on se concentre sur la création de l'opération comptable

        // Enregistrer dans l'historique
        try {
            historiqueService.enregistrer(
                    cotisation.getMembreId(),
                    "Validation cotisation",
                    String.format("Cotisation #%d validée par trésorier #%d - Périodes: %s, Montant: %s FCFA",
                        cotisationId, tresorierId, cotisation.getPeriodes(), cotisation.getMontant()),
                    Enums.HistoType.COTISATION,
                    "cotisation",
                    saved.getId()
            );
        } catch (Exception histoException) {
            log.warn("Historique de la validation non enregistré (non bloquant) : {}", histoException.getMessage());
        }

        // Notifier le rafraîchissement des stats du dashboard
        try {
            statsService.notifyRefresh();
        } catch (Exception e) {
            log.warn("Rafraîchissement des statistiques impossible (non bloquant) : {}", e.getMessage());
        }

        final var cotisationValidee = saved;
        notifications.sansRisque(() -> notifications.informer(cotisationValidee.getMembreId(), Enums.NotifType.INFO,
                "Cotisation validée",
                "Votre cotisation de " + cotisationValidee.getMontant().toBigInteger() + " FCFA (" + cotisationValidee.getPeriodes()
                        + ") a été validée par le trésorier. Merci !",
                Enums.TopicType.COTISATION, cotisationValidee.getId(), true));

        return saved;
    }

    /**
     * Rejeter une cotisation
     */
    @Transactional
    public Cotisation rejeter(Long cotisationId, Long tresorierId, String motif) {
        var cotisation = cotisationRepo.findById(cotisationId)
                .orElseThrow(() -> new NotFoundException("Cotisation introuvable"));

        if (cotisation.getStatut() != Enums.CotiStatut.EN_ATTENTE) {
            throw new IllegalStateException("Seules les cotisations EN_ATTENTE peuvent être rejetées");
        }

        // Marquer comme rejetée au lieu de supprimer pour permettre la traçabilité
        cotisation.setStatut(Enums.CotiStatut.REJETE);
        
        // Stocker le motif dans la remarque si elle est vide, sinon l'ajouter
        String motifComplet = String.format("Rejetée par trésorier #%d - Motif: %s", tresorierId, motif);
        if (cotisation.getRemarque() == null || cotisation.getRemarque().trim().isEmpty()) {
            cotisation.setRemarque(motifComplet);
        } else {
            cotisation.setRemarque(cotisation.getRemarque() + " | " + motifComplet);
        }
        
        cotisation = cotisationRepo.save(cotisation);

        historiqueService.enregistrer(
                cotisation.getMembreId(),
                "Rejet cotisation",
                String.format("Cotisation #%d rejetée par trésorier #%d - Motif: %s",
                    cotisationId, tresorierId, motif),
                Enums.HistoType.COTISATION,
                "cotisation",
                cotisation.getId()
        );

        final var cotisationRejetee = cotisation;
        notifications.sansRisque(() -> notifications.informer(cotisationRejetee.getMembreId(), Enums.NotifType.ALERTE,
                "Cotisation non validée",
                "Votre déclaration de cotisation (" + cotisationRejetee.getPeriodes() + ") n'a pas été validée.\n\nMotif : " + motif
                        + "\n\nVous pouvez en déclarer une nouvelle.",
                Enums.TopicType.COTISATION, cotisationRejetee.getId(), true));

        return cotisation;
    }

    /**
     * Récupérer les cotisations d'un membre
     * Triées par date de paiement décroissante (plus récent en premier)
     */
    public List<Cotisation> getMesCotisations(Long membreId) {
        List<Cotisation> cotisations = cotisationRepo.findByMembreIdOrderByPeriodeDesc(membreId);
        // Trier par date de paiement décroissante, puis par ID décroissant
        return cotisations.stream()
                .sorted((c1, c2) -> {
                    if (c1.getDatePaiement() == null && c2.getDatePaiement() == null) return 0;
                    if (c1.getDatePaiement() == null) return 1;
                    if (c2.getDatePaiement() == null) return -1;
                    int dateCompare = c2.getDatePaiement().compareTo(c1.getDatePaiement());
                    if (dateCompare != 0) return dateCompare;
                    return Long.compare(c2.getId(), c1.getId());
                })
                .collect(Collectors.toList());
    }

    /**
     * Récupérer toutes les cotisations en attente
     */
    public List<Cotisation> getCotisationsEnAttente() {
        return cotisationRepo.findByStatut(Enums.CotiStatut.EN_ATTENTE);
    }

    /**
     * Vérifier quels mois ne sont pas encore payés pour un membre
     */
    public List<String> getMoisNonPayes(Long membreId, int annee) {
        // Récupérer toutes les cotisations PAYE du membre
        List<Cotisation> cotisations = cotisationRepo.findByMembreIdAndStatut(membreId, Enums.CotiStatut.PAYE);

        // Extraire toutes les périodes payées
        List<String> periodesPayees = cotisations.stream()
                .flatMap(c -> List.of(c.getPeriodes().split(",")).stream())
                .map(String::trim)
                .distinct()
                .collect(Collectors.toList());

        // Déterminer le mois limite : pour l'année courante, ne prendre que jusqu'au mois actuel
        // Pour les années passées, prendre tous les 12 mois
        int anneeCourante = java.time.LocalDate.now().getYear();
        int moisLimite = (annee == anneeCourante) ? java.time.LocalDate.now().getMonthValue() : 12;

        // Générer les mois de l'année jusqu'au mois limite
        List<String> tousMois = new ArrayList<>();
        for (int mois = 1; mois <= moisLimite; mois++) {
            tousMois.add(String.format("%d-%02d", annee, mois));
        }

        // Retourner les mois non payés
        tousMois.removeAll(periodesPayees);
        return tousMois;
    }

    /**
     * Générer la liste des périodes à partir d'un mois de début et un nombre de mois
     */
    private List<String> genererPeriodes(String moisDebut, int nombreMois) {
        List<String> periodes = new ArrayList<>();

        YearMonth debut = YearMonth.parse(moisDebut, PERIODE_FORMATTER);

        for (int i = 0; i < nombreMois; i++) {
            YearMonth periode = debut.plusMonths(i);
            periodes.add(periode.format(PERIODE_FORMATTER));
        }

        return periodes;
    }

    /**
     * Valider le format du mois de début
     */
    private void validerFormatMoisDebut(String moisDebut) {
        if (moisDebut == null || moisDebut.isEmpty()) {
            throw new IllegalArgumentException("Le mois de début est requis");
        }

        // Vérifier le format yyyy-MM
        if (!moisDebut.matches("^\\d{4}-(0[1-9]|1[0-2])$")) {
            throw new IllegalArgumentException(
                "Format de date invalide: '" + moisDebut + "'. Format attendu: yyyy-MM (ex: 2026-01)"
            );
        }

        try {
            YearMonth ym = YearMonth.parse(moisDebut, PERIODE_FORMATTER);

            // Vérifier que l'année est raisonnable
            int year = ym.getYear();
            int currentYear = YearMonth.now().getYear();

            if (year < 2020 || year > currentYear + 5) {
                throw new IllegalArgumentException(
                    String.format("Année invalide (%d). L'année doit être entre 2020 et %d",
                        year, currentYear + 5)
                );
            }
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("Impossible de parser la date: " + moisDebut, e);
        }
    }

    /**
     * Récupérer les cotisations d'un membre avec les infos du membre (DTO)
     */
    public List<CotisationResponseDTO> getMesCotisationsDTO(Long membreId) {
        List<Cotisation> cotisations = cotisationRepo.findByMembreIdOrderByPeriodeDesc(membreId);
        return enrichirAvecMembres(cotisations);
    }

    /**
     * Récupérer les cotisations en attente avec les infos du membre (DTO)
     */
    public List<CotisationResponseDTO> getCotisationsEnAttenteDTO() {
        List<Cotisation> cotisations = cotisationRepo.findByStatut(Enums.CotiStatut.EN_ATTENTE);
        return enrichirAvecMembres(cotisations);
    }

    /**
     * Récupérer toutes les cotisations avec les infos du membre (DTO)
     * Triées par date de paiement décroissante (plus récent en premier)
     */
    public List<CotisationResponseDTO> getToutesCotisationsDTO() {
        List<Cotisation> cotisations = cotisationRepo.findAllOrderByDatePaiementDesc();
        return enrichirAvecMembres(cotisations);
    }

    /**
     * Convertir une cotisation en DTO avec les infos du membre
     */
    public CotisationResponseDTO toDTO(Cotisation cotisation) {
        Membre membre = membreRepo.findById(cotisation.getMembreId()).orElse(null);
        String membreNom = membre != null
                ? (membre.getFirstName() + " " + membre.getLastName()).trim()
                : "Membre #" + cotisation.getMembreId();
        String membreEmail = membre != null ? membre.getEmail() : null;

        return new CotisationResponseDTO(
                cotisation.getId(),
                cotisation.getMembreId(),
                membreNom,
                membreEmail,
                cotisation.getPeriodes(),
                cotisation.getNombreMois(),
                cotisation.getMontant(),
                cotisation.getDatePaiement(),
                cotisation.getStatut() != null ? cotisation.getStatut().name() : null,
                cotisation.getModePaiement() != null ? cotisation.getModePaiement().name() : null,
                cotisation.getReference(),
                cotisation.getRemarque(),
                cotisation.getOperationId(),
                cotisation.getValideParTresorier(),
                cotisation.getDateValidation(),
                cotisation.getPhotoPreuve()
        );
    }

    /**
     * Enrichir une liste de cotisations avec les informations des membres
     */
    private List<CotisationResponseDTO> enrichirAvecMembres(List<Cotisation> cotisations) {
        if (cotisations.isEmpty()) {
            return new ArrayList<>();
        }

        // Récupérer tous les IDs de membres uniques
        List<Long> membreIds = cotisations.stream()
                .map(Cotisation::getMembreId)
                .distinct()
                .collect(Collectors.toList());

        // Charger tous les membres en une seule requête
        Map<Long, Membre> membresMap = membreRepo.findAllById(membreIds).stream()
                .collect(Collectors.toMap(Membre::getId, Function.identity()));

        // Convertir en DTO avec les infos du membre
        return cotisations.stream()
                .map(c -> {
                    Membre membre = membresMap.get(c.getMembreId());
                    String membreNom = membre != null
                            ? (membre.getFirstName() + " " + membre.getLastName()).trim()
                            : "Membre #" + c.getMembreId();
                    String membreEmail = membre != null ? membre.getEmail() : null;

                    return new CotisationResponseDTO(
                            c.getId(),
                            c.getMembreId(),
                            membreNom,
                            membreEmail,
                            c.getPeriodes(),
                            c.getNombreMois(),
                            c.getMontant(),
                            c.getDatePaiement(),
                            c.getStatut() != null ? c.getStatut().name() : null,
                            c.getModePaiement() != null ? c.getModePaiement().name() : null,
                            c.getReference(),
                            c.getRemarque(),
                            c.getOperationId(),
                            c.getValideParTresorier(),
                            c.getDateValidation(),
                            c.getPhotoPreuve()
                    );
                })
                .collect(Collectors.toList());
    }

    /**
     * Vérifier qu'aucune des périodes n'est déjà payée ou en attente de validation
     */
    private void verifierPeriodesNonPayees(Long membreId, List<String> periodes) {
        // Normaliser les périodes à vérifier (trim et format)
        List<String> periodesNormalisees = periodes.stream()
                .map(String::trim)
                .filter(p -> !p.isBlank())
                .collect(Collectors.toList());

        if (periodesNormalisees.isEmpty()) {
            throw new IllegalArgumentException("Aucune période valide à vérifier");
        }

        // Récupérer les cotisations PAYE et EN_ATTENTE uniquement
        List<Cotisation> cotisationsPaye = cotisationRepo.findByMembreIdAndStatut(membreId, Enums.CotiStatut.PAYE);
        List<Cotisation> cotisationsEnAttente = cotisationRepo.findByMembreIdAndStatut(membreId, Enums.CotiStatut.EN_ATTENTE);

        // Combiner les deux listes avec leurs statuts
        List<Cotisation> toutesLesCotisations = new ArrayList<>();
        toutesLesCotisations.addAll(cotisationsPaye);
        toutesLesCotisations.addAll(cotisationsEnAttente);

        // Vérifier chaque période
        List<String> conflits = new ArrayList<>();
        StringBuilder detailsConflits = new StringBuilder();

        for (String periode : periodesNormalisees) {
            for (Cotisation cot : toutesLesCotisations) {
                if (cot.getPeriodes() == null || cot.getPeriodes().isBlank()) {
                    continue; // Ignorer les cotisations sans périodes
                }
                
                // Extraire et normaliser les périodes de la cotisation existante
                List<String> periodesExistantes = List.of(cot.getPeriodes().split(",")).stream()
                        .map(String::trim)
                        .filter(p -> !p.isBlank())
                        .collect(Collectors.toList());

                // Comparaison exacte (sensible à la casse)
                if (periodesExistantes.contains(periode)) {
                    conflits.add(periode);
                    detailsConflits.append(String.format(
                        "\n- Période %s : cotisation #%d (statut: %s, montant: %s FCFA, date: %s, périodes: %s)",
                        periode,
                        cot.getId(),
                        cot.getStatut() == Enums.CotiStatut.PAYE ? "PAYÉE" : "EN ATTENTE",
                        cot.getMontant(),
                        cot.getDatePaiement(),
                        cot.getPeriodes()
                    ));
                    break; // Une seule cotisation par période suffit
                }
            }
        }

        if (!conflits.isEmpty()) {
            throw new IllegalArgumentException(
                    "Les périodes suivantes sont déjà enregistrées : " +
                    String.join(", ", conflits.stream().distinct().collect(Collectors.toList())) +
                    detailsConflits.toString() +
                    "\n\nVeuillez soit :\n" +
                    "1. Choisir d'autres périodes non encore payées\n" +
                    "2. Modifier/supprimer la cotisation existante si c'est une erreur\n" +
                    "3. Contacter la trésorerie si une cotisation EN ATTENTE doit être rejetée"
            );
        }
    }
}
