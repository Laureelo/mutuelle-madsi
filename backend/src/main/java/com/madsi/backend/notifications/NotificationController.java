package com.madsi.backend.notifications;

import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.notifications.repo.NotificationRepository;
import com.madsi.backend.security.AccessGuard;
import org.springframework.data.domain.Page;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Notifications dans l'application (la cloche) : chacun ne voit QUE les siennes. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;
    private final NotificationRepository repo;
    private final AccessGuard guard;

    public NotificationController(NotificationService service, NotificationRepository repo, AccessGuard guard) {
        this.service = service;
        this.repo = repo;
        this.guard = guard;
    }

    @GetMapping
    public Page<Notification> list(@RequestParam Long destinataireId,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "10") int size) {
        if (!guard.isSelf(destinataireId)) throw new AccessDeniedException("Accès refusé");
        return service.listByDest(destinataireId, Math.max(page, 0), Math.min(Math.max(size, 1), 100));
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(@RequestParam Long destinataireId) {
        if (!guard.isSelf(destinataireId)) throw new AccessDeniedException("Accès refusé");
        return Map.of("count", service.countNonLues(destinataireId));
    }

    @PostMapping("/{id}/lu")
    public Map<String, String> markRead(@PathVariable Long id) {
        var notif = repo.findById(id).orElseThrow(() -> new NotFoundException("Notification introuvable"));
        if (!guard.isSelf(notif.getDestinataireId())) throw new AccessDeniedException("Accès refusé");
        service.marquerCommeLue(id);
        return Map.of("status", "ok");
    }

    @PostMapping("/tout-lu")
    public Map<String, Object> markAllRead(@RequestParam Long destinataireId) {
        if (!guard.isSelf(destinataireId)) throw new AccessDeniedException("Accès refusé");
        return Map.of("status", "ok", "count", service.marquerToutesLues(destinataireId));
    }
}
