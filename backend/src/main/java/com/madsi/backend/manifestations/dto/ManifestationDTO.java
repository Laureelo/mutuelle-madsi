package com.madsi.backend.manifestations.dto;

import com.madsi.backend.common.Enums;
import java.time.LocalDate;
import java.math.BigDecimal;

public record ManifestationDTO(
        Long id,
        Long membreId,
        Long typeActiviteId,
        String libelle,
        LocalDate date,
        String lieu,
        String description,
        Enums.ManifStatut statut,
        BigDecimal montantDepense,
        BigDecimal montantPrevu,
        BigDecimal montantReel,
        String materiaux,
        String remarques,
        LocalDate dateCloture,
        Long cloturePar,
        String membreNom,
        String membrePrenom,
        Integer moisImpayesMembre   // mois de cotisation impayés du bénéficiaire (information, demandes en attente seulement)
) {}