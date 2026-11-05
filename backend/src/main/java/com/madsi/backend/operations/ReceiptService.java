package com.madsi.backend.operations;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import com.madsi.backend.common.Enums;
import com.madsi.backend.common.Enums.ModePaiement;
import com.madsi.backend.common.Enums.ObjetRecu;
import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Génération des reçus de versement (statuts, art. 20 : « Pour toute somme versée, la mutuelle est tenue
 * de remettre un reçu de versement au membre »).
 *
 * Le service est « auto-réparateur » : si le reçu d'une opération n'existe pas encore (opération validée
 * avant la mise en place des reçus) ou si son fichier PDF a disparu, il est (re)généré à la demande.
 */
@Service
@RequiredArgsConstructor
public class ReceiptService {

    private static final Logger log = LoggerFactory.getLogger(ReceiptService.class);
    private static final Path DOSSIER = Path.of("uploads", "recus");

    private final RecuRepository recuRepo;
    private final OperationRepository opRepo;
    private final MembreRepository membreRepo;
    private final SettingsService settingsService;

    /** Reçu sans détail supplémentaire (compatibilité). */
    public Recu generate(Operation op, ObjetRecu objet, BigDecimal montant,
                         ModePaiement mode, String reference) {
        return generate(op, objet, montant, mode, reference, null);
    }

    /**
     * Crée un reçu numéroté (ex. MADSI-2026-000042) et génère son PDF (uploads/recus/...).
     *
     * @param detail ligne facultative décrivant l'objet (ex. « Périodes : 2026-01, 2026-02 »)
     */
    public Recu generate(Operation op, ObjetRecu objet, BigDecimal montant,
                         ModePaiement mode, String reference, String detail) {
        var r = Recu.builder()
                .operation(op)
                .montant(montant)
                .objet(objet)
                .modePaiement(mode)
                .reference(reference)
                .dateRecu(java.time.OffsetDateTime.now())
                .build();
        r = recuRepo.save(r);
        recuRepo.flush();

        // numéro lisible et unique, basé sur l'identifiant : PRÉFIXE-ANNÉE-NNNNNN
        String numero = "%s%d-%06d".formatted(settingsService.prefixRecu(), op.getDateOp().getYear(), r.getId());
        r.setNumero(numero);

        try {
            ecrirePdf(op, objet, montant, mode, reference, detail, numero);
            r.setFichierPdfUrl("/api/recus/" + r.getId() + "/pdf");
        } catch (Exception e) {
            log.error("Génération du PDF du reçu {} impossible", numero, e);
            r.setFichierPdfUrl(null);
        }
        return recuRepo.save(r);
    }

    /** Reçu d'une opération ; créé s'il n'existe pas encore (opérations validées avant les reçus). */
    public Recu pourOperation(Long operationId) {
        var existant = recuRepo.findTopByOperationIdOrderByIdDesc(operationId);
        if (existant.isPresent()) return existant.get();

        var op = opRepo.findById(operationId)
                .orElseThrow(() -> new NotFoundException("Opération introuvable"));
        if (op.getStatut() == Enums.OpStatut.ANNULEE) {
            throw new NotFoundException("Cette opération a été annulée : pas de reçu.");
        }
        ObjetRecu objet = switch (op.getTypeOp()) {
            case COTISATION -> ObjetRecu.COTISATION;
            case APPORT -> "adhesion".equals(op.getObjetType()) ? ObjetRecu.ADHESION : ObjetRecu.APPORT;
            case RECETTE -> ObjetRecu.RECETTE;
            case DEPENSE -> ObjetRecu.DEPENSE;
            case REMBOURSEMENT_PRET -> ObjetRecu.REMBOURSEMENT_PRET;
        };
        return generate(op, objet, op.getMontant(), op.getModePaiement(), op.getReference());
    }

    /** Membre concerné par un reçu (l'opération liée est chargée à la demande). */
    public Long membreIdOf(Recu recu) {
        if (recu.getOperation() == null) return null;
        return opRepo.findById(recu.getOperation().getId()).map(Operation::getMembreId).orElse(null);
    }

    /** Chemin du PDF d'un reçu ; le fichier est régénéré s'il manque (ex. dossier uploads non recopié). */
    public Path fichierPdf(Recu recu) {
        if (recu.getNumero() == null) {
            throw new NotFoundException("Ce reçu n'a pas de numéro");
        }
        Path pdf = DOSSIER.resolve(recu.getNumero() + ".pdf");
        if (!Files.exists(pdf)) {
            try {
                var op = opRepo.findById(recu.getOperation().getId())
                        .orElseThrow(() -> new NotFoundException("Opération introuvable"));
                ecrirePdf(op, recu.getObjet(), recu.getMontant(), recu.getModePaiement(), recu.getReference(), null, recu.getNumero());
            } catch (Exception e) {
                log.error("Régénération du PDF du reçu {} impossible", recu.getNumero(), e);
                throw new NotFoundException("Fichier PDF du reçu indisponible");
            }
        }
        return pdf;
    }

    // ------------------------------------------------------------------

    private void ecrirePdf(Operation op, ObjetRecu objet, BigDecimal montant, ModePaiement mode,
                           String reference, String detail, String numero) throws IOException {
        Files.createDirectories(DOSSIER);

        String membre = "-";
        if (op.getMembreId() != null) {
            membre = membreRepo.findById(op.getMembreId())
                    .map(m -> ((m.getFirstName() == null ? "" : m.getFirstName()) + " "
                            + (m.getLastName() == null ? "" : m.getLastName())).trim()
                            + (m.getMatricule() != null ? "  (matricule " + m.getMatricule() + ")" : ""))
                    .orElse("Membre n° " + op.getMembreId());
        }

        var org = settingsService.get().getOrganisation();
        String organisation = org != null && org.getNom() != null ? org.getNom() : "MADSI";

        Document doc = new Document(PageSize.A5);
        try (var out = new FileOutputStream(DOSSIER.resolve(numero + ".pdf").toFile())) {
            PdfWriter.getInstance(doc, out);
            doc.open();

            var titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
            var labelFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
            var textFont  = FontFactory.getFont(FontFactory.HELVETICA, 11);
            var smallFont = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 9);

            var titre = new Paragraph("MUTUELLE " + organisation, titleFont);
            titre.setAlignment(Element.ALIGN_CENTER);
            doc.add(titre);
            var sousTitre = new Paragraph("Reçu de versement", titleFont);
            sousTitre.setAlignment(Element.ALIGN_CENTER);
            doc.add(sousTitre);
            doc.add(new Paragraph(" "));

            doc.add(new Paragraph("Numéro : " + numero, labelFont));
            doc.add(new Paragraph("Date : " + op.getDateOp().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), textFont));
            doc.add(new Paragraph("Reçu de : " + membre, textFont));
            doc.add(new Paragraph("Objet : " + libelle(objet), textFont));
            if (detail != null && !detail.isBlank()) doc.add(new Paragraph(detail, textFont));
            doc.add(new Paragraph("Montant : " + NumberFormat.getIntegerInstance(Locale.FRANCE).format(montant) + " FCFA", labelFont));
            doc.add(new Paragraph("Mode de paiement : " + (mode == null ? "-" : mode == ModePaiement.ESPECES ? "Espèces" : "Mobile money"), textFont));
            doc.add(new Paragraph("Référence : " + (reference == null || reference.isBlank() ? "-" : reference), textFont));
            doc.add(new Paragraph(" "));
            doc.add(new Paragraph("Merci pour votre versement.", textFont));
            doc.add(new Paragraph(" "));
            doc.add(new Paragraph("Document généré par l'application " + organisation
                    + " - opération n° " + op.getId(), smallFont));
            doc.close();
        }
    }

    private static String libelle(ObjetRecu objet) {
        return switch (objet) {
            case ADHESION -> "Droit d'adhésion";
            case COTISATION -> "Cotisation mensuelle";
            case APPORT -> "Apport";
            case RECETTE -> "Recette";
            case DEPENSE -> "Dépense / décaissement";
            case REMBOURSEMENT_PRET -> "Remboursement de prêt";
        };
    }
}
