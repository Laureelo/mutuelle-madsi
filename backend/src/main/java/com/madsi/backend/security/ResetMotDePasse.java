package com.madsi.backend.security;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Demande de réinitialisation de mot de passe. Seule l'empreinte (SHA-256) du lien est conservée :
 * même en lisant la base, on ne peut pas reconstituer un lien valable.
 */
@Entity
@Table(name = "reset_mot_de_passe", indexes = @Index(name = "idx_reset_empreinte", columnList = "empreinte"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ResetMotDePasse {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "membre_id", nullable = false)
    private Long membreId;

    @Column(nullable = false, length = 64, unique = true)
    private String empreinte;

    @Column(name = "cree_le", nullable = false)
    private LocalDateTime creeLe;

    @Column(name = "expire_le", nullable = false)
    private LocalDateTime expireLe;

    @Column(nullable = false)
    private boolean utilise;
}
