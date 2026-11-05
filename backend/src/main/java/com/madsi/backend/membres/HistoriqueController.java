// src/main/java/com/madsi/backend/membres/HistoriqueController.java
package com.madsi.backend.membres;

import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.historique.HistoriqueService;
import com.madsi.backend.membres.dto.HistoriqueDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/historiques")
@RequiredArgsConstructor
public class HistoriqueController {

    private final HistoriqueService service;
    private final com.madsi.backend.security.AccessGuard guard;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    @GetMapping
    public PageResponse<HistoriqueDTO> list(@RequestParam Long membreId,
                                            @RequestParam(defaultValue="0") int page,
                                            @RequestParam(defaultValue="10") int size){
        guard.ensureSelfOrStaff(membreId);
        var p = service.list(membreId, Math.max(page, 0), Math.min(Math.max(size, 1), 200))
                .map(h -> new HistoriqueDTO(
                        h.getId(),
                        h.getMembreId(),
                        h.getType().name(),
                        h.getAction(),
                        h.getDetails(),
                        h.getDateEvt()==null ? null : h.getDateEvt().format(ISO)
                ));
        return PageResponse.of(p);
    }
}