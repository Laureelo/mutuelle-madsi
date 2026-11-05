package com.madsi.backend.participations;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "participations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"manifestation_id", "membre_id"})
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Participation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "manifestation_id", nullable = false)
    private Long manifestationId;

    @Column(name = "membre_id", nullable = false)
    private Long membreId;

    @Column(nullable = false)
    private Boolean confirmation = true;

    @Column(name = "nombre_accompagnants")
    private Integer nombreAccompagnants = 0;

    @Column(length = 500)
    private String remarque;

    @Column(name = "date_inscription", nullable = false)
    private LocalDateTime dateInscription;

    @PrePersist
    protected void onCreate() {
        if (dateInscription == null) {
            dateInscription = LocalDateTime.now();
        }
        if (confirmation == null) {
            confirmation = true;
        }
        if (nombreAccompagnants == null) {
            nombreAccompagnants = 0;
        }
    }
}
