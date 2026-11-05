package com.madsi.backend.rapports;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.madsi.backend.common.Enums;
import com.madsi.backend.common.Enums.HistoType;
import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.rapports.dto.RapportExportDTO;
import com.madsi.backend.rapports.dto.RapportParamsDTO;
import com.madsi.backend.security.AccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Génération des rapports (PDF, Excel, CSV). Le contenu est construit par {@link RapportsDonnees} puis écrit par {@link RapportRendu} :
 * un seul contenu, trois formats, donc les chiffres sont identiques quel que soit le fichier choisi.
 */
@Service
@RequiredArgsConstructor
public class RapportsService {

    private static final DateTimeFormatter HORODATAGE = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final RapportExportRepository exportRepo;
    private final RapportsDonnees donnees;
    private final MembreRepository membreRepo;
    private final AccessGuard guard;
    private final HistoriqueService histo;
    private final ObjectMapper om = new ObjectMapper();

    public PageResponse<RapportExportDTO> history(int page, int size) {
        var p = exportRepo.findAllByOrderByGenereLeDesc(PageRequest.of(page, size));
        return PageResponse.of(p.map(this::toDTO));
    }

    public RapportExportDTO generate(RapportParamsDTO in) {
        if (in.periodeDebut() == null || in.periodeFin() == null) {
            throw new IllegalArgumentException("Choisissez une période (date de début et date de fin).");
        }
        if (in.periodeDebut().isAfter(in.periodeFin())) {
            throw new IllegalArgumentException("La date de début doit être antérieure ou égale à la date de fin.");
        }
        if (in.periodeDebut().plusYears(11).isBefore(in.periodeFin())) {
            throw new IllegalArgumentException("La période ne peut pas dépasser 10 ans.");
        }
        String modele = choisirModele(in);
        String fmt = in.export() != null && in.export().format() != null ? in.export().format().toUpperCase() : "PDF";
        if (!List.of("PDF", "CSV", "XLSX").contains(fmt)) fmt = "PDF";

        String auteur = null;
        Long auteurId = null;
        try {
            auteurId = guard.currentMembreId();
            auteur = membreRepo.findById(auteurId)
                    .map(m -> ((m.getFirstName() == null ? "" : m.getFirstName()) + " " + (m.getLastName() == null ? "" : m.getLastName())).trim())
                    .orElse(null);
        } catch (Exception ignore) {
            // rapport généré hors requête : pas d'auteur
        }

        LocalDate debut = in.periodeDebut(), fin = in.periodeFin();
        RapportDoc doc = donnees.construire(modele, debut, fin, in.filtres(), auteur);

        Path dossier = Path.of("uploads", "rapports");
        Path fichier;
        try {
            Files.createDirectories(dossier);
            String base = "rapport-" + modele.toLowerCase() + "-" + debut + "_" + fin + "-" + OffsetDateTime.now().format(HORODATAGE);
            fichier = dossier.resolve(base + "." + fmt.toLowerCase());
            switch (fmt) {
                case "XLSX" -> RapportRendu.xlsx(fichier, doc);
                case "CSV" -> RapportRendu.csv(fichier, doc);
                default -> RapportRendu.pdf(fichier, doc);
            }
        } catch (Exception ex) {
            throw new IllegalStateException("La génération du fichier a échoué : " + ex.getMessage(), ex);
        }

        String periodeLabel = debut + ".." + fin;
        var export = RapportExport.builder()
                .type(typePour(modele))
                .periode(periodeLabel)
                .format(fmt)
                .fichierPath(fichier.toString())
                .fichierUrl("/api/rapports/exports/pending")
                .genereLe(OffsetDateTime.now())
                .paramsJson(json(in))
                .metaJson(json(Map.of("modele", modele)))
                .generatedBy(auteurId)
                .build();
        export = exportRepo.save(export);
        export.setFichierUrl("/api/rapports/exports/" + export.getId() + "/file");
        export = exportRepo.save(export);

        histo.enregistrer(null, "Génération de rapport",
                "modele=%s, période=%s, format=%s".formatted(modele, periodeLabel, fmt),
                HistoType.SYSTEME, "rapport", export.getId());
        return toDTO(export);
    }

    /** Nom de fichier proposé au téléchargement (le nom du fichier sur le disque, sans l'horodatage). */
    public String nomFichier(RapportExport r) {
        String n = Path.of(r.getFichierPath()).getFileName().toString();
        return n.replaceFirst("-\\d{8}-\\d{6}(\\.[a-z]+)$", "$1");
    }

    private static String choisirModele(RapportParamsDTO in) {
        if (in.modele() != null && !in.modele().isBlank()) {
            String m = in.modele().trim().toUpperCase();
            if (List.of(RapportsDonnees.JOURNAL, RapportsDonnees.COTISATIONS, RapportsDonnees.PRETS,
                    RapportsDonnees.MEMBRES, RapportsDonnees.ACTIVITES, RapportsDonnees.ANNUEL).contains(m)) return m;
            throw new IllegalArgumentException("Type de rapport inconnu : " + in.modele());
        }
        if (in.type() == null) return RapportsDonnees.JOURNAL;
        return switch (in.type()) {
            case STATISTIQUE -> RapportsDonnees.MEMBRES;
            case METIER -> RapportsDonnees.ACTIVITES;
            case FIN_DE_MANDAT -> RapportsDonnees.ANNUEL;
            default -> RapportsDonnees.JOURNAL;
        };
    }

    private static Enums.RapportType typePour(String modele) {
        return switch (modele) {
            case RapportsDonnees.MEMBRES -> Enums.RapportType.STATISTIQUE;
            case RapportsDonnees.ACTIVITES -> Enums.RapportType.METIER;
            case RapportsDonnees.ANNUEL -> Enums.RapportType.FIN_DE_MANDAT;
            default -> Enums.RapportType.FINANCIER;
        };
    }

    private RapportExportDTO toDTO(RapportExport r) {
        return new RapportExportDTO(r.getId(), r.getType(), r.getPeriode(), r.getFormat(), r.getFichierUrl(), r.getGenereLe(), r.getTotalGlobal());
    }

    private String json(Object o) {
        try {
            return om.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }
}
