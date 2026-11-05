package com.madsi.backend.rapports.dto;

import com.madsi.backend.common.Enums.*;
import java.time.LocalDate;
import java.util.List;

/**
 * Paramètres d'un rapport.
 * {@code modele} choisit le contenu : JOURNAL, COTISATIONS, PRETS, MEMBRES, ACTIVITES ou ANNUEL.
 * S'il est absent, il est déduit de {@code type} (compatibilité avec les anciens appels).
 */
public record RapportParamsDTO(
        LocalDate periodeDebut,
        LocalDate periodeFin,
        RapportType type,
        Filtres filtres,
        Export export,
        String modele
){
    public record Filtres(Long membreId, SensOp sens, List<TypeOperation> typesOperation) {}
    public record Export(String format, Boolean envoyerParEmail, List<String> destinatairesEmail) {}
}
