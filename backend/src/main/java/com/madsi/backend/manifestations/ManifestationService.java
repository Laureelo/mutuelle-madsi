// src/main/java/com/madsi/backend/manifestations/ManifestationService.java
package com.madsi.backend.manifestations;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.Enums.ManifStatut;
import com.madsi.backend.common.Enums.HistoType;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.manifestations.dto.ManifestationDTO;
import com.madsi.backend.manifestations.dto.ManifestationIn;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.operations.OperationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ManifestationService {

    private final ManifestationRepository repo;
    private final OperationRepository opRepo;
    private final HistoriqueService histo;
    private final NotificationManifestationService notifManif;
    private final MembreRepository membreRepo;
    private final TypeActiviteRepository typeRepo;
    private final com.madsi.backend.membres.EligibiliteService eligibilite;

    /** Une même maladie ouvre droit à 2 visites au plus ; la 2e au moins 2 semaines après la 1re (règlement, art. 11). */
    private static final int ECART_MIN_VISITES_JOURS = 14;
    /** Deux visites séparées de plus de ce nombre de jours sont considérées comme deux maladies différentes. */
    private static final int FENETRE_MALADIE_JOURS = 90;

    /**
     * Contrôles avant d'accorder une prestation sociale (mariage, naissance, maladie, retraite, décès) :
     * le bénéficiaire doit être à jour de ses cotisations (art. 11 et 18) et, pour la maladie, les règles de visites s'appliquent.
     */
    private void verifierPrestation(Manifestation m) {
        if (m.getTypeActiviteId() == null || m.getMembreId() == null) return;
        var type = typeRepo.findById(m.getTypeActiviteId()).orElse(null);
        if (type == null || type.getType() == null) return;
        var cat = type.getType();
        boolean prestationSociale = cat == Enums.TypeActiviteCat.MARIAGE || cat == Enums.TypeActiviteCat.NAISSANCE
                || cat == Enums.TypeActiviteCat.MALADIE || cat == Enums.TypeActiviteCat.RETRAITE
                || cat == Enums.TypeActiviteCat.DECES;
        if (!prestationSociale) return; // sport, culture : pas de condition de cotisation

        eligibilite.exigerAJour(m.getMembreId(), "cette prestation");

        if (cat == Enums.TypeActiviteCat.MALADIE && m.getDate() != null) {
            var idsMaladie = typeRepo.findByType(Enums.TypeActiviteCat.MALADIE).stream().map(TypeActivite::getId).toList();
            var memeEpisode = repo.findByMembreIdAndTypeActiviteIdIn(m.getMembreId(), idsMaladie).stream()
                    .filter(o -> !o.getId().equals(m.getId()))
                    .filter(o -> o.getStatut() == ManifStatut.PLANIFIEE || o.getStatut() == ManifStatut.REALISEE)
                    .filter(o -> o.getDate() != null
                            && Math.abs(java.time.temporal.ChronoUnit.DAYS.between(o.getDate(), m.getDate())) <= FENETRE_MALADIE_JOURS)
                    .sorted(java.util.Comparator.comparing(Manifestation::getDate))
                    .toList();
            if (memeEpisode.size() >= 2) {
                throw new IllegalStateException("Deux visites de maladie ont déjà été accordées à ce membre : c'est le maximum prévu par le règlement (art. 11).");
            }
            if (memeEpisode.size() == 1) {
                var premiere = memeEpisode.get(0);
                long ecart = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(premiere.getDate(), m.getDate()));
                if (ecart < ECART_MIN_VISITES_JOURS) {
                    throw new IllegalStateException("La deuxième visite de maladie doit avoir lieu au moins 2 semaines après la première (visite du "
                            + premiere.getDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")) + ").");
                }
            }
        }
    }

    private ManifestationDTO toDTO(Manifestation m){
        BigDecimal dep = opRepo.sumDepensesForManifestation(m.getId());
        
        // Récupérer le nom du membre organisateur
        String membreNom = null;
        String membrePrenom = null;
        if (m.getMembreId() != null) {
            var membreOpt = membreRepo.findById(m.getMembreId());
            if (membreOpt.isPresent()) {
                var membre = membreOpt.get();
                membreNom = membre.getLastName();
                membrePrenom = membre.getFirstName();
            }
        }
        
        return new ManifestationDTO(
                m.getId(),
                m.getMembreId(),
                m.getTypeActiviteId(),
                m.getLibelle(),
                m.getDate(),
                m.getLieu(),
                m.getDescription(),
                m.getStatut(),
                dep,
                m.getMontantPrevu(),
                m.getMontantReel(),
                m.getMateriaux(),
                m.getRemarques(),
                m.getDateCloture(),
                m.getCloturePar(),
                membreNom,
                membrePrenom,
                (m.getStatut() == ManifStatut.EN_ATTENTE && m.getMembreId() != null)
                        ? eligibilite.nombreMoisImpayes(m.getMembreId()) : null
        );
    }

    public ManifestationDTO get(Long id){
        var m = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Manifestation introuvable"));
        return toDTO(m);
    }

    public PageResponse<ManifestationDTO> search(String q, String statut, LocalDate from, LocalDate to, int page, int size){
        Specification<Manifestation> spec = (root, cq, cb) -> cb.conjunction();
        
        // Filtre par recherche textuelle
        if (q != null && !q.isBlank()) {
            String like = "%" + q.trim().toLowerCase() + "%";
            spec = spec.and((root, cq, cb) -> 
                cb.like(cb.lower(root.get("libelle")), like)
            );
        }
        
        // Filtre par statut
        if (statut != null && !statut.isBlank()) {
            spec = spec.and((root, cq, cb) -> 
                cb.equal(root.get("statut"), ManifStatut.valueOf(statut))
            );
        }
        
        // Filtre par date début
        if (from != null) {
            spec = spec.and((root, cq, cb) -> 
                cb.greaterThanOrEqualTo(root.get("date"), from)
            );
        }
        
        // Filtre par date fin
        if (to != null) {
            spec = spec.and((root, cq, cb) -> 
                cb.lessThanOrEqualTo(root.get("date"), to)
            );
        }
        
        // Trier par ID décroissant (les plus récents créés en premier), puis par date décroissante
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id", "date"));
        var p = repo.findAll(spec, pageable);
        return PageResponse.of(p.map(this::toDTO));
    }

    public ManifestationDTO create(ManifestationIn in){
        var m = Manifestation.builder()
                .membreId(in.membreId())
                .typeActiviteId(in.typeActiviteId())
                .libelle(in.libelle())
                .date(in.date())
                .lieu(in.lieu())
                .description(in.description())
                .statut(in.statut() != null ? in.statut() : Enums.ManifStatut.EN_ATTENTE)
                .build();

        var saved = repo.save(m);

        histo.enregistrer(
                saved.getMembreId(),
                "Création manifestation",
                "manifId=%d, libelle=%s".formatted(saved.getId(), saved.getLibelle()),
                HistoType.MANIFESTATION,
                "manifestation", saved.getId()
        );

        return toDTO(saved);
    }

    public ManifestationDTO update(Long id, ManifestationIn in){
        var m = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Manifestation introuvable"));

        m.setMembreId(in.membreId());
        m.setTypeActiviteId(in.typeActiviteId());
        m.setLibelle(in.libelle());
        m.setDate(in.date());
        m.setLieu(in.lieu());
        m.setDescription(in.description());
        if (in.statut() != null) m.setStatut(in.statut());

        var out = repo.save(m);

        histo.enregistrer(
                out.getMembreId(),
                "Mise à jour manifestation",
                "manifId=%d".formatted(out.getId()),
                HistoType.MANIFESTATION,
                "manifestation", out.getId()
        );

        return toDTO(out);
    }

    /** 
     * Validation par le trésorier → statut PLANIFIEE + notification à tous les membres
     * La manifestation est maintenant planifiée et visible par tous
     */
    public ManifestationDTO validate(Long id, Long acteurId){
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Manifestation introuvable"));
        if (m.getStatut() != ManifStatut.EN_ATTENTE) {
            throw new IllegalStateException("Seule une manifestation en attente peut être validée (statut actuel : " + m.getStatut() + ").");
        }
        if (acteurId != null && acteurId.equals(m.getMembreId())) {
            throw new IllegalStateException("Vous ne pouvez pas valider votre propre demande : un autre responsable doit le faire.");
        }
        verifierPrestation(m);
        m.setStatut(ManifStatut.PLANIFIEE);
        var out = repo.save(m);

        // Notifier tous les membres actifs
        notifierTousLesMembres(out, "VALIDATION");

        histo.enregistrer(
                out.getMembreId(),
                "Validation manifestation par trésorier",
                "manifId=%d, statut=PLANIFIEE".formatted(out.getId()),
                HistoType.MANIFESTATION,
                "manifestation", out.getId()
        );

        return toDTO(out);
    }

    /**
     * Annulation par le membre déclarant → statut ANNULEE + notification à tous les membres
     * Le membre peut annuler sans passer par le trésorier
     */
    public ManifestationDTO annulerParMembre(Long id, Long membreId){
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Manifestation introuvable"));
        
        // Vérifier que c'est bien le membre déclarant
        if (!m.getMembreId().equals(membreId)) {
            throw new IllegalStateException("Seul le membre déclarant peut annuler cette manifestation");
        }
        
        // Ne peut annuler que si en PLANIFIEE ou si pas encore validée
        if (m.getStatut() == ManifStatut.REALISEE) {
            throw new IllegalStateException("Une manifestation réalisée ne peut pas être annulée");
        }
        
        m.setStatut(ManifStatut.ANNULEE);
        var out = repo.save(m);

        // Notifier tous les membres de l'annulation
        notifierTousLesMembres(out, "ANNULATION");

        histo.enregistrer(
                out.getMembreId(),
                "Annulation manifestation par membre",
                "manifId=%d".formatted(out.getId()),
                HistoType.MANIFESTATION,
                "manifestation", out.getId()
        );

        return toDTO(out);
    }

    /**
     * Clôture de la manifestation par le trésorier
     * Remplit le formulaire de clôture et passe le statut à REALISEE
     */
    public ManifestationDTO cloturer(Long id, Long tresorierId, BigDecimal montantPrevu, 
                                      BigDecimal montantReel, String materiaux, String remarques){
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Manifestation introuvable"));
        
        if (m.getStatut() != ManifStatut.PLANIFIEE) {
            throw new IllegalStateException("Seules les manifestations planifiées peuvent être clôturées");
        }
        
        m.setStatut(ManifStatut.REALISEE);
        m.setMontantPrevu(montantPrevu);
        m.setMontantReel(montantReel);
        m.setMateriaux(materiaux);
        m.setRemarques(remarques);
        m.setDateCloture(LocalDate.now());
        m.setCloturePar(tresorierId);
        var out = repo.save(m);

        histo.enregistrer(
                out.getMembreId(),
                "Clôture manifestation",
                "manifId=%d, montantPrevu=%s, montantReel=%s".formatted(out.getId(), montantPrevu, montantReel),
                HistoType.MANIFESTATION,
                "manifestation", out.getId()
        );

        return toDTO(out);
    }

    /**
     * Notifie tous les membres actifs d'une manifestation
     */
    private void notifierTousLesMembres(Manifestation m, String sousType) {
        List<Long> membresActifs = membreRepo.findAll()
                .stream()
                .filter(mem -> mem.getEtatCompte() == Enums.EtatCompte.ACTIF)
                .map(com.madsi.backend.membres.Membre::getId)
                .toList();
        
        for (Long membreId : membresActifs) {
            notifManif.sendNotificationGenerale(membreId, m, sousType);
        }
    }

    /** Rejet par la trésorière → statut ANNULEE + notification au déclarant (avec motif) */
    public ManifestationDTO reject(Long id, String motif){
        var m = repo.findById(id).orElseThrow(() -> new NotFoundException("Manifestation introuvable"));
        m.setStatut(ManifStatut.ANNULEE);
        var out = repo.save(m);

        if (out.getMembreId()!=null){
            notifManif.sendRejet(out.getMembreId(), out, motif==null? "-" : motif);
        }

        histo.enregistrer(
                out.getMembreId(),
                "Rejet manifestation",
                "manifId=%d, motif=%s".formatted(out.getId(), motif==null?"-":motif),
                HistoType.MANIFESTATION,
                "manifestation", out.getId()
        );

        return toDTO(out);
    }
}