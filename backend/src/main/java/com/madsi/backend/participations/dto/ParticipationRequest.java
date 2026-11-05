package com.madsi.backend.participations.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParticipationRequest {
    @Builder.Default
    private Boolean confirmation = true;
    @Builder.Default
    private Integer nombreAccompagnants = 0;
    private String remarque;
}
