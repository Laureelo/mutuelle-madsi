package com.madsi.backend.notifications;

import com.madsi.backend.common.Enums;
import com.madsi.backend.common.Enums.NotifType;
import com.madsi.backend.common.Enums.TopicType;
import com.madsi.backend.membres.EligibiliteService;
import com.madsi.backend.prets.Echeance;
import com.madsi.backend.prets.EcheanceRepository;
import com.madsi.backend.prets.PretRepository;
import com.madsi.backend.prets.RemboursementRepository;
import com.madsi.backend.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

/**
 * Rappels automatiques (une seule source, tous les jours à 9 h tant que le serveur tourne) :
 * - échéances de remboursement : 3 jours avant, le jour même, le lendemain, puis chaque semaine de retard ;
 * - cotisations impayées : le 1er de chaque mois.
 * Chaque rappel est envoyé une seule fois (clé de déduplication) : redémarrer le serveur ne crée pas de doublons.
 * Les rappels s'activent ou se coupent dans Paramètres.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RappelsPlanifies {

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final EcheanceRepository echRepo;
    private final PretRepository pretRepo;
    private final RemboursementRepository remRepo;
    private final NotificationService notifications;
    private final EligibiliteService eligibilite;
    private final SettingsService settings;

    @Scheduled(cron = "0 0 9 * * *")
    public void rappelsEcheances() {
        executerRappelsEcheances(LocalDate.now());
    }

    @Scheduled(cron = "0 15 9 1 * *")
    public void rappelCotisations() {
        executerRappelCotisations(LocalDate.now());
    }

    /** @return nombre de rappels envoyés */
    public int executerRappelsEcheances(LocalDate aujourdhui) {
        if (!settings.rappelsEcheancesActifs()) return 0;
        int n = 0;
        for (Echeance e : echRepo.findDueBetween(aujourdhui, aujourdhui.plusDays(3))) {
            long jours = ChronoUnit.DAYS.between(aujourdhui, e.getDateEcheance());
            if (jours == 3 || jours == 0) n += rappeler(e, "J-" + jours, aujourdhui);
        }
        for (Echeance e : echRepo.findOverdueBefore(aujourdhui)) {
            long retard = ChronoUnit.DAYS.between(e.getDateEcheance(), aujourdhui);
            if (retard == 1 || retard % 7 == 0) n += rappeler(e, "R+" + retard, aujourdhui);
        }
        log.info("Rappels d'échéances envoyés : {}", n);
        return n;
    }

    private int rappeler(Echeance e, String cle, LocalDate aujourdhui) {
        var pret = pretRepo.findById(e.getPretId()).orElse(null);
        if (pret == null || pret.getStatut() != Enums.PretStatut.EN_COURS) return 0;
        BigDecimal reste = e.getMontantDu().subtract(remRepo.sumByEcheance(e.getId()));
        if (reste.signum() <= 0) return 0;

        long ecart = ChronoUnit.DAYS.between(aujourdhui, e.getDateEcheance());
        String montant = String.format("%,d", reste.longValue()).replace(',', ' ') + " FCFA";
        String sujet;
        String texte;
        NotifType type;
        if (ecart > 0) {
            type = NotifType.RAPPEL;
            sujet = "Rappel : remboursement à effectuer le " + e.getDateEcheance().format(JOUR);
            texte = "Votre échéance n° " + e.getNumero() + " de " + montant + " arrive à terme dans " + ecart
                    + " jours (le " + e.getDateEcheance().format(JOUR) + ").";
        } else if (ecart == 0) {
            type = NotifType.RAPPEL;
            sujet = "Rappel : remboursement dû aujourd'hui";
            texte = "Votre échéance n° " + e.getNumero() + " de " + montant + " est due aujourd'hui.";
        } else {
            type = NotifType.ALERTE;
            sujet = "Remboursement en retard";
            texte = "Votre échéance n° " + e.getNumero() + " de " + montant + " était due le "
                    + e.getDateEcheance().format(JOUR) + " (" + (-ecart) + " jour(s) de retard). Merci de la régler au plus vite.";
        }
        var n = notifications.informer(pret.getMembreId(), type, sujet,
                texte + "\n\nPour toute difficulté, parlez-en au trésorier.", TopicType.ECHEANCE, e.getId(), true, cle);
        return n == null ? 0 : 1;
    }

    /** @return nombre de rappels envoyés */
    public int executerRappelCotisations(LocalDate aujourdhui) {
        if (!settings.rappelsCotisationsActifs()) return 0;
        String cle = "COTIS-" + aujourdhui.getYear() + "-" + String.format("%02d", aujourdhui.getMonthValue());
        int n = 0;
        for (var a : eligibilite.arrieres()) {
            String montant = String.format("%,d", a.montantDu().longValue()).replace(',', ' ') + " FCFA";
            var r = notifications.informer(a.membreId(), NotifType.RAPPEL, "Rappel : cotisations impayées",
                    "Il vous reste " + a.nombreMois() + " mois de cotisation à régler, soit " + montant
                            + " (de " + a.moisImpayes().get(0) + " à " + a.moisImpayes().get(a.moisImpayes().size() - 1) + ").\n\n"
                            + "Vous pouvez déclarer votre paiement dans l'application, rubrique Cotisations.",
                    TopicType.COTISATION, a.membreId(), true, cle);
            if (r != null) n++;
        }
        log.info("Rappels de cotisations envoyés : {}", n);
        return n;
    }
}
