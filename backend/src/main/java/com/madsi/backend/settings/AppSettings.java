package com.madsi.backend.settings;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Stocke un unique document JSON de paramètres (row id=1).
 */
@Entity
@Table(name = "app_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppSettings {

    @Id
    @Column(name = "id")
    private Long id; // toujours 1

    /** Contenu JSON (sérialisé) */
    @Lob
    @Column(name = "content_json", nullable = false, columnDefinition = "TEXT")
    private String contentJson;

    /** Traçabilité */
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy; // id admin qui a modifié (optionnel)

    @PrePersist
    public void onCreate() {
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (id == null) id = 1L;
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}