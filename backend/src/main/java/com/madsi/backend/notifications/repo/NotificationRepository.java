package com.madsi.backend.notifications.repo;

import com.madsi.backend.common.Enums;
import com.madsi.backend.notifications.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** Liste paginée des notifications d'un membre (du plus récent au plus ancien). */
    Page<Notification> findByDestinataireIdOrderByDateEnvoiDesc(Long destinataireId, Pageable pageable);

    /** Nombre de notifications non lues (état ENVOYE). */
    long countByDestinataireIdAndEtat(Long destinataireId, Enums.NotifEtat etat);

    /** Ce message (même clé) a-t-il déjà été envoyé à ce membre ? */
    boolean existsByDestinataireIdAndTopicTypeAndTopicIdAndSousType(Long destinataireId, Enums.TopicType topicType,
                                                                    Long topicId, String sousType);

    @Modifying
    @Query("update Notification n set n.etat = :lu where n.id = :id")
    int markAsRead(@Param("id") Long id, @Param("lu") Enums.NotifEtat lu);

    @Modifying
    @Query("update Notification n set n.etat = :lu where n.destinataireId = :dest and n.etat = :nonLu")
    int markAllAsRead(@Param("dest") Long dest, @Param("lu") Enums.NotifEtat lu, @Param("nonLu") Enums.NotifEtat nonLu);
}
