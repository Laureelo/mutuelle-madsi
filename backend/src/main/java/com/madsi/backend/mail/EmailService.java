package com.madsi.backend.mail;

import com.madsi.backend.settings.SettingsService;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

/**
 * Envoi réel des emails (compte Gmail technique de la mutuelle, ou tout serveur SMTP).
 *
 * - Rien n'est envoyé tant que le serveur de messagerie n'est pas configuré (fichier backend/.env) :
 *   l'application fonctionne normalement, avec les notifications dans l'application seulement ;
 * - l'envoi se fait en arrière-plan et ne bloque jamais l'utilisateur ;
 * - chaque tentative est notée dans le journal (email_log) : envoyé ou en échec, avec la raison.
 */
@Slf4j
@Service
public class EmailService {

    private final ObjectProvider<JavaMailSender> senderProvider;
    private final EmailLogRepository logRepo;
    private final SettingsService settings;

    @Value("${spring.mail.host:}") private String host;
    @Value("${spring.mail.username:}") private String username;
    @Value("${app.mail.from:}") private String from;
    @Value("${app.public-url:}") private String publicUrl;

    public EmailService(ObjectProvider<JavaMailSender> senderProvider, EmailLogRepository logRepo, SettingsService settings) {
        this.senderProvider = senderProvider;
        this.logRepo = logRepo;
        this.settings = settings;
    }

    /** Le serveur de messagerie est-il renseigné dans la configuration ? */
    public boolean estConfigure() {
        return host != null && !host.isBlank() && senderProvider.getIfAvailable() != null;
    }

    /** L'administrateur peut couper les emails dans les Paramètres, même si la messagerie est configurée. */
    public boolean sontAutorises() {
        var n = settings.get().getNotifications();
        return n == null || n.getCanalEmailEnabled() == null || n.getCanalEmailEnabled();
    }

    public boolean estActif() {
        return estConfigure() && sontAutorises();
    }

    public String adresseExpediteur() {
        return (from != null && !from.isBlank()) ? from : username;
    }

    // ------------------------------------------------------------------
    // Envoi
    // ------------------------------------------------------------------

    /** Envoi en arrière-plan. Sans effet si les emails ne sont pas actifs. */
    @Async("mailExecutor")
    public void envoyerAsync(Long membreId, String adresse, String sujet, String titre, String texte, String type) {
        if (!estActif()) return;
        envoyerMaintenant(membreId, adresse, sujet, titre, texte, type);
    }

    /** Envoi immédiat ; ne lève jamais d'exception. Retourne null si tout va bien, sinon la raison de l'échec. */
    public String envoyerMaintenant(Long membreId, String adresse, String sujet, String titre, String texte, String type) {
        if (adresse == null || adresse.isBlank() || !adresse.contains("@")) return "Adresse email absente ou invalide.";
        JavaMailSender sender = senderProvider.getIfAvailable();
        if (sender == null || !estConfigure()) return "La messagerie n'est pas configurée (fichier backend/.env).";
        String erreur = null;
        try {
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, StandardCharsets.UTF_8.name());
            String expediteur = adresseExpediteur();
            if (expediteur != null && !expediteur.isBlank()) {
                h.setFrom(expediteur, nomOrganisation());
            }
            String reponse = adresseReponse();
            if (reponse != null) h.setReplyTo(reponse);
            h.setTo(adresse.trim());
            h.setSubject(sujet);
            h.setText(texteBrut(titre, texte), habiller(titre, texte));
            sender.send(msg);
        } catch (Exception e) {
            erreur = resume(e);
            log.warn("Échec d'envoi d'email à {} : {}", adresse, erreur);
        }
        try {
            logRepo.save(EmailLog.builder()
                    .destinataireId(membreId).adresse(adresse).sujet(sujet).type(type)
                    .statut(erreur == null ? EmailLog.ENVOYE : EmailLog.ECHEC)
                    .erreur(erreur).dateEnvoi(LocalDateTime.now()).build());
        } catch (Exception e) {
            log.warn("Journal d'emails : écriture impossible ({})", e.getMessage());
        }
        return erreur;
    }

    // ------------------------------------------------------------------
    // Mise en forme
    // ------------------------------------------------------------------

    private String nomOrganisation() {
        var org = settings.get().getOrganisation();
        return (org != null && org.getNom() != null && !org.getNom().isBlank()) ? org.getNom() : "MADSI";
    }

    /** Les réponses des membres vont à l'adresse de contact de la mutuelle, si elle est renseignée. */
    private String adresseReponse() {
        var org = settings.get().getOrganisation();
        String a = org == null ? null : org.getEmailContact();
        if (a == null || !a.contains("@") || a.endsWith(".local")) return null;
        return a.trim();
    }

    private static String resume(Exception e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) t = t.getCause();
        String m = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
        m = m.replaceAll("\\s+", " ").trim();
        return m.length() > 300 ? m.substring(0, 300) : m;
    }

    private String lien() {
        return (publicUrl == null || publicUrl.isBlank()) ? null : publicUrl.trim();
    }

    private String texteBrut(String titre, String texte) {
        String l = lien();
        return titre + "\n\n" + texte + (l != null ? "\n\nOuvrir l'application : " + l : "")
                + "\n\n- " + nomOrganisation() + " (message automatique)";
    }

    private String habiller(String titre, String texte) {
        StringBuilder paragraphes = new StringBuilder();
        for (String p : texte.split("\\n\\s*\\n")) {
            if (p.isBlank()) continue;
            paragraphes.append("<p style=\"margin:0 0 14px 0;line-height:1.55\">")
                    .append(HtmlUtils.htmlEscape(p.trim()).replace("\n", "<br>")).append("</p>");
        }
        String l = lien();
        String bouton = l == null ? "" :
                "<p style=\"margin:22px 0 4px 0\"><a href=\"" + HtmlUtils.htmlEscape(l) + "\" style=\"background:#3d9fa8;color:#ffffff;"
                        + "text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block\">Ouvrir l'application</a></p>";
        return "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f3f5f7;font-family:Segoe UI,Arial,sans-serif;color:#2b3440\">"
                + "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td align=\"center\" style=\"padding:24px 12px\">"
                + "<table width=\"560\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden\">"
                + "<tr><td style=\"background:#3d9fa8;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:700;border-bottom:3px solid #e89a3c\">"
                + HtmlUtils.htmlEscape(nomOrganisation()) + "</td></tr>"
                + "<tr><td style=\"padding:24px\"><h2 style=\"margin:0 0 16px 0;font-size:20px;color:#2f3e5c\">" + HtmlUtils.htmlEscape(titre) + "</h2>"
                + paragraphes + bouton + "</td></tr>"
                + "<tr><td style=\"padding:14px 24px;background:#f8f9fa;color:#8a94a6;font-size:12px\">"
                + "Message envoyé automatiquement par l'application de la mutuelle.</td></tr>"
                + "</table></td></tr></table></body></html>";
    }
}
