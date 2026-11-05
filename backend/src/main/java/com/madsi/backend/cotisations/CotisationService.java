package com.madsi.backend.cotisations;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import com.madsi.backend.common.Enums.CotiStatut;
import com.madsi.backend.common.Enums.HistoType;
import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.Enums.ObjetRecu;
import com.madsi.backend.common.Enums.OpStatut;
import com.madsi.backend.common.Enums.TypeOperation;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.cotisations.dto.CotisationDTO;
import com.madsi.backend.cotisations.dto.ExistsResponse;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.operations.Operation;
import com.madsi.backend.operations.OperationRepository;
import com.madsi.backend.operations.OperationService;
import com.madsi.backend.operations.ReceiptService;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class CotisationService {

    private final CotisationRepository repo;
    private final OperationService operationService;
    private final ReceiptService receiptService;
    private final MembreRepository membreRepo;
    private final OperationRepository opRepo;
    private final HistoriqueService histo;
    private final com.madsi.backend.notifications.NotificationService notifications;

    /**
     * Méthode helper pour extraire la première période d'une liste de périodes CSV
     */
    private String getPremierePeriode(Cotisation c) {
        if (c.getPeriodes() == null || c.getPeriodes().isEmpty()) {
            return "";
        }
        return c.getPeriodes().split(",")[0].trim();
    }

    public List<Cotisation> parMembre(Long membreId){
        // Note: Cette méthode utilise l'ancien tri par periode
        // Pour le nouveau système, utilisez CotisationMembreService.getMesCotisations()
        return repo.findByMembreIdOrderByPeriodeDesc(membreId);
    }

    public ExistsResponse checkExists(Long membreId, String periode){
        if (membreId == null || periode == null || periode.isBlank()) {
            return new ExistsResponse(false, null);
        }

        // Normaliser la période recherchée
        String periodeNormalisee = periode.trim();
        
        // Récupérer toutes les cotisations du membre
        var cotisations = repo.findByMembreIdOrderByPeriodeDesc(membreId);
        
        // Vérifier si la période existe dans une des cotisations
        Cotisation cotisationTrouvee = null;
        for (var cotisation : cotisations) {
            if (cotisation.getPeriodes() != null && !cotisation.getPeriodes().isBlank()) {
                // Split les périodes et vérifier chaque période individuellement
                String[] periodes = cotisation.getPeriodes().split(",");
                for (String p : periodes) {
                    String periodeTrimmee = p.trim();
                    if (periodeNormalisee.equals(periodeTrimmee)) {
                        cotisationTrouvee = cotisation;
                        break;
                    }
                }
                if (cotisationTrouvee != null) {
                    break;
                }
            }
        }

        boolean exists = cotisationTrouvee != null;
        CotisationDTO cotisationDTO = null;

        if (exists && cotisationTrouvee != null) {
            var m = membreRepo.findById(cotisationTrouvee.getMembreId()).orElse(new Membre());
            String nom = ((m.getFirstName()==null?"":m.getFirstName())+" "+(m.getLastName()==null?"":m.getLastName())).trim();

            // Utiliser periodes (nouveau champ) ou prendre la première période
            String periodeAffichee = cotisationTrouvee.getPeriodes() != null && !cotisationTrouvee.getPeriodes().isEmpty()
                ? cotisationTrouvee.getPeriodes().split(",")[0].trim()
                : "";

            cotisationDTO = new CotisationDTO(
                cotisationTrouvee.getId(), cotisationTrouvee.getMembreId(),
                nom.isBlank()?null:nom, m.getEmail(),
                periodeAffichee, cotisationTrouvee.getMontant(), cotisationTrouvee.getDatePaiement(),
                cotisationTrouvee.getStatut().name(),
                cotisationTrouvee.getModePaiement()==null?null:cotisationTrouvee.getModePaiement().name(),
                cotisationTrouvee.getReference(),
                cotisationTrouvee.getOperationId(),
                null,
                cotisationTrouvee.getPhotoPreuve()
            );
        }

        return new ExistsResponse(exists, cotisationDTO);
    }

    /**
     * Créer une cotisation (sans créer l'opération comptable)
     * L'opération comptable sera créée lors de la validation par la trésorerie
     * Utilisé pour créer des cotisations directement par la trésorerie (statut PAYE) ou pour les déclarations (statut EN_ATTENTE)
     */
    @Transactional
    public Cotisation creer(Cotisation c, ModePaiement mode, String reference){
        if (c.getMembreId() == null) {
            throw new IllegalArgumentException("L'ID du membre est requis");
        }
        if (c.getPeriodes() == null || c.getPeriodes().isBlank()) {
            throw new IllegalArgumentException("La période est requise");
        }

        // Normaliser les périodes
        String periodeNormalisee = c.getPeriodes().trim();
        c.setPeriodes(periodeNormalisee);

        // Vérifier si une cotisation existe déjà pour ce membre pour CHAQUE période
        // On vérifie uniquement les cotisations PAYE et EN_ATTENTE (on ignore EN_RETARD, PARTIEL, etc.)
        var cotisationsPaye = repo.findByMembreIdAndStatut(c.getMembreId(), com.madsi.backend.common.Enums.CotiStatut.PAYE);
        var cotisationsEnAttente = repo.findByMembreIdAndStatut(c.getMembreId(), com.madsi.backend.common.Enums.CotiStatut.EN_ATTENTE);
        
        // Combiner les deux listes
        var cotisationsExistantes = new java.util.ArrayList<Cotisation>();
        cotisationsExistantes.addAll(cotisationsPaye);
        cotisationsExistantes.addAll(cotisationsEnAttente);
        
        String[] periodes = periodeNormalisee.split(",");
        for (String periode : periodes) {
            String periodeTrimmee = periode.trim();
            if (periodeTrimmee.isBlank()) {
                continue; // Ignorer les périodes vides
            }
            // Vérifier si cette période existe dans une des cotisations existantes
            for (var cotisationExistante : cotisationsExistantes) {
                if (cotisationExistante.getPeriodes() != null && !cotisationExistante.getPeriodes().isBlank()) {
                    String[] periodesExistantes = cotisationExistante.getPeriodes().split(",");
                    for (String p : periodesExistantes) {
                        if (periodeTrimmee.equals(p.trim())) {
                            throw new IllegalArgumentException(
                                String.format("Une cotisation existe déjà pour ce membre pour la période %s. Veuillez choisir une autre période ou modifier la cotisation existante.", periodeTrimmee)
                            );
                        }
                    }
                }
            }
        }
        
        c.setModePaiement(mode);
        c.setReference(reference);
        
        // Si le statut n'est pas défini, mettre EN_ATTENTE par défaut
        if (c.getStatut() == null) {
            c.setStatut(com.madsi.backend.common.Enums.CotiStatut.EN_ATTENTE);
        }

        // Sauvegarder la cotisation d'abord pour obtenir l'ID
        Cotisation saved = repo.save(c);
        repo.flush(); // Force la persistance pour obtenir l'ID
        
        // Vérifier que l'ID a été généré
        if (saved.getId() == null) {
            throw new IllegalStateException("Erreur : l'ID de la cotisation n'a pas été généré après la sauvegarde");
        }
        
        // Si le statut est PAYE, créer l'opération comptable immédiatement (création directe par trésorier)
        // Sinon, l'opération sera créée lors de la validation par la trésorerie
        if (saved.getStatut() == com.madsi.backend.common.Enums.CotiStatut.PAYE) {
            try {
                Operation op = operationService.credit(
                        TypeOperation.COTISATION,
                        saved.getMontant(),
                        mode,
                        reference,
                        saved.getMembreId(),
                        "cotisation",
                        saved.getId()
                );
                
                // Mettre à jour la cotisation avec l'ID de l'opération
                saved.setOperationId(op.getId());
                saved = repo.save(saved);
                repo.flush();
            } catch (Exception opException) {
                // Si l'opération échoue, supprimer la cotisation créée pour éviter les orphelins
                repo.delete(saved);
                repo.flush();
                throw new RuntimeException("Erreur lors de la création de l'opération comptable: " + opException.getMessage(), opException);
            }
        }
        
        // Enregistrer dans l'historique (non-bloquant)
        try {
            histo.enregistrer(
                    saved.getMembreId(),
                    "Création cotisation",
                    "cotisationId=%d, montant=%s, mode=%s, ref=%s, statut=%s".formatted(
                        saved.getId(), saved.getMontant(), mode, reference, saved.getStatut()),
                    HistoType.COTISATION,
                    "cotisation", saved.getId()
            );
        } catch (Exception histoException) {
            // Log l'erreur mais continue - l'historique n'est pas critique
            System.err.println("Erreur lors de l'enregistrement dans l'historique (non bloquant): " + histoException.getMessage());
        }
        
        return saved;
    }

    public PageResponse<CotisationDTO> searchAdmin(String q, String mois, String mode, String statut, int page, int size){
        List<Long> memberIds = null;
        if (q != null && !q.isBlank()){
            memberIds = membreRepo.searchIds(q);
            if (memberIds.isEmpty()){
                return new PageResponse<>(List.of(), page, size, 0, 0);
            }
        }

        var p = repo.searchAdmin(mois, mode, statut, memberIds, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));

        var ids = p.stream().map(Cotisation::getMembreId).distinct().toList();
        Map<Long, Membre> map = membreRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(Membre::getId, m -> m));

        var mapped = p.map(c -> {
            var m = map.getOrDefault(c.getMembreId(), new Membre());
            String nom = ((m.getFirstName()==null?"":m.getFirstName())+" "+(m.getLastName()==null?"":m.getLastName())).trim();
            return new CotisationDTO(
                    c.getId(), c.getMembreId(),
                    nom.isBlank()?null:nom, m.getEmail(),
                    getPremierePeriode(c), c.getMontant(), c.getDatePaiement(),
                    c.getStatut().name(),
                    c.getModePaiement()==null?null:c.getModePaiement().name(),
                    c.getReference(),
                    c.getOperationId(),
                    null,
                    c.getPhotoPreuve()
            );
        });

        return PageResponse.of(mapped);
    }

    public CotisationDTO getById(Long id){
        var c = repo.findById(id).orElseThrow(() -> new NotFoundException("Cotisation introuvable"));
        var m = membreRepo.findById(c.getMembreId()).orElse(new Membre());
        String nom = ((m.getFirstName()==null?"":m.getFirstName())+" "+(m.getLastName()==null?"":m.getLastName())).trim();
        final var cotValidee = c;
        notifications.sansRisque(() -> notifications.informer(cotValidee.getMembreId(), com.madsi.backend.common.Enums.NotifType.INFO,
                "Cotisation validée",
                "Votre cotisation de " + cotValidee.getMontant().toBigInteger() + " FCFA (" + cotValidee.getPeriodes() + ") a été validée par le trésorier. Merci !",
                com.madsi.backend.common.Enums.TopicType.COTISATION, cotValidee.getId(), true));

        return new CotisationDTO(
                c.getId(), c.getMembreId(),
                nom.isBlank()?null:nom, m.getEmail(),
                getPremierePeriode(c), c.getMontant(), c.getDatePaiement(),
                c.getStatut().name(),
                c.getModePaiement()==null?null:c.getModePaiement().name(),
                c.getReference(),
                c.getOperationId(),
                null,
                c.getPhotoPreuve()
        );
    }

    @Transactional
    public CotisationDTO update(Long id, java.math.BigDecimal montant, String periode,
                                java.time.LocalDate datePaiement, ModePaiement modePaiement,
                                String reference, CotiStatut statut){
        var c = repo.findById(id).orElseThrow(() -> new NotFoundException("Cotisation introuvable"));

        if (montant != null) c.setMontant(montant);
        if (periode != null) c.setPeriodes(periode);  // Changé setPeriode en setPeriodes
        if (datePaiement != null) c.setDatePaiement(datePaiement);
        if (modePaiement != null) c.setModePaiement(modePaiement);
        if (reference != null) c.setReference(reference);
        if (statut != null) c.setStatut(statut);

        c = repo.save(c);

        var m = membreRepo.findById(c.getMembreId()).orElse(new Membre());
        String nom = ((m.getFirstName()==null?"":m.getFirstName())+" "+(m.getLastName()==null?"":m.getLastName())).trim();

        histo.enregistrer(
                c.getMembreId(),
                "Modification cotisation",
                "cotisationId=%d".formatted(c.getId()),
                HistoType.COTISATION,
                "cotisation", c.getId()
        );

        return new CotisationDTO(
                c.getId(), c.getMembreId(),
                nom.isBlank()?null:nom, m.getEmail(),
                getPremierePeriode(c), c.getMontant(), c.getDatePaiement(),
                c.getStatut().name(),
                c.getModePaiement()==null?null:c.getModePaiement().name(),
                c.getReference(),
                c.getOperationId(),
                null,
                c.getPhotoPreuve()
        );
    }

    @Transactional
    public void delete(Long id){
        var c = repo.findById(id).orElseThrow(() -> new NotFoundException("Cotisation introuvable"));
        
        if (c.getOperationId() != null){
            var op = opRepo.findById(c.getOperationId()).orElse(null);
            if (op != null){
                op.setStatut(OpStatut.ANNULEE);
                opRepo.save(op);
            }
        }

        histo.enregistrer(
                c.getMembreId(),
                "Suppression cotisation",
                "cotisationId=%d".formatted(id),
                HistoType.COTISATION,
                "cotisation", c.getId()
        );

        repo.delete(c);
    }

    @Transactional
    public CotisationDTO valider(Long cotisationId){
        var c = repo.findById(cotisationId).orElseThrow(() -> new NotFoundException("Cotisation introuvable"));
        
        // Vérifier que la cotisation est en attente
        if (c.getStatut() != CotiStatut.EN_ATTENTE) {
            throw new IllegalStateException("Seules les cotisations EN_ATTENTE peuvent être validées");
        }
        
        // Si l'opération n'existe pas encore, la créer
        if (c.getOperationId() == null) {
            try {
                Operation op = operationService.credit(
                        TypeOperation.COTISATION,
                        c.getMontant(),
                        c.getModePaiement(),
                        c.getReference(),
                        c.getMembreId(),
                        "cotisation",
                        c.getId()
                );
                
                // Reçu de versement (statuts, art. 20)
                receiptService.generate(op, com.madsi.backend.common.Enums.ObjetRecu.COTISATION, c.getMontant(),
                        c.getModePaiement(), c.getReference(),
                        c.getPeriodes() == null ? null : "Périodes : " + c.getPeriodes().replace(",", ", "));

                // Mettre à jour la cotisation avec l'ID de l'opération
                c.setOperationId(op.getId());
            } catch (Exception opException) {
                throw new RuntimeException("Erreur lors de la création de l'opération comptable: " + opException.getMessage(), opException);
            }
        }
        
        // Mettre à jour le statut
        c.setStatut(CotiStatut.PAYE);
        c = repo.save(c);
        repo.flush();

        var m = membreRepo.findById(c.getMembreId()).orElse(new Membre());
        String nom = ((m.getFirstName()==null?"":m.getFirstName())+" "+(m.getLastName()==null?"":m.getLastName())).trim();

        histo.enregistrer(
                c.getMembreId(),
                "Validation cotisation",
                "cotisationId=%d".formatted(cotisationId),
                HistoType.COTISATION,
                "cotisation", c.getId()
        );

        return new CotisationDTO(
                c.getId(), c.getMembreId(),
                nom.isBlank()?null:nom, m.getEmail(),
                getPremierePeriode(c), c.getMontant(), c.getDatePaiement(),
                c.getStatut().name(),
                c.getModePaiement()==null?null:c.getModePaiement().name(),
                c.getReference(),
                c.getOperationId(),
                null,
                c.getPhotoPreuve()
        );
    }

    @Transactional
    public CotisationDTO annuler(Long cotisationId, String motif){
        var c = repo.findById(cotisationId).orElseThrow(() -> new NotFoundException("Cotisation introuvable"));
        if (c.getStatut() == CotiStatut.REJETE) {
            throw new IllegalStateException("Cette cotisation est déjà annulée ou rejetée.");
        }
        // Une cotisation annulée redevient impayée (sinon elle resterait comptée comme payée)
        c.setStatut(CotiStatut.REJETE);
        String note = "Annulée : " + (motif == null || motif.isBlank() ? "-" : motif);
        c.setRemarque(c.getRemarque() == null || c.getRemarque().isBlank() ? note : c.getRemarque() + " | " + note);
        c = repo.save(c);
        if (c.getOperationId() != null){
            var op = opRepo.findById(c.getOperationId()).orElse(null);
            if (op != null){
                op.setStatut(OpStatut.ANNULEE);
                opRepo.save(op);
            }
        }
        var m = membreRepo.findById(c.getMembreId()).orElse(new Membre());
        String nom = ((m.getFirstName()==null?"":m.getFirstName())+" "+(m.getLastName()==null?"":m.getLastName())).trim();

        histo.enregistrer(
                c.getMembreId(),
                "Annulation cotisation",
                "cotisationId=%d, motif=%s".formatted(cotisationId, motif),
                HistoType.COTISATION,
                "cotisation", c.getId()
        );

        return new CotisationDTO(
                c.getId(), c.getMembreId(),
                nom.isBlank()?null:nom, m.getEmail(),
                getPremierePeriode(c), c.getMontant(), c.getDatePaiement(),
                c.getStatut().name(),
                c.getModePaiement()==null?null:c.getModePaiement().name(),
                c.getReference(),
                c.getOperationId(),
                null,
                c.getPhotoPreuve()
        );
    }

    public java.math.BigDecimal getTotalByPeriode(String periode){
        return repo.findAll().stream()
                .filter(c -> c.getPeriodes() != null && c.getPeriodes().contains(periode) && c.getStatut() == CotiStatut.PAYE)
                .map(Cotisation::getMontant)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
    }

}