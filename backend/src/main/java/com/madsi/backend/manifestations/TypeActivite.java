package com.madsi.backend.manifestations;

import com.madsi.backend.common.Enums;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "types_activite")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TypeActivite {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false, length = 200)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(nullable=false, length = 30)
    private Enums.TypeActiviteCat type; // MARIAGE, SPORT, ...

    private String sousType;      // ex: Football
    private Integer montantAlloue;
    private String lieu;
}