package com.madsi.backend.participations.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParticipationResponse {
    private Long id;
    private Long manifestationId;
    private Long membreId;
    private String membrePrenom;
    private String membreNom;
    private String membrePhotoUrl;
    private Boolean confirmation;
    private Integer nombreAccompagnants;
    private String remarque;
    private LocalDateTime dateInscription;
}
