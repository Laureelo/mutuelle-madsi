// src/main/java/com/madsi/backend/stats/StatsController.java
package com.madsi.backend.stats;

import com.madsi.backend.stats.dto.MembershipStatsDTO;
import com.madsi.backend.stats.dto.TreasuryStatsDTO;
import org.springframework.web.bind.annotation.*;

import java.time.Year;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService svc;

    public StatsController(StatsService svc) { this.svc = svc; }

    private static int annee(Integer year) {
        int y = (year != null ? year : Year.now().getValue());
        if (y < 2000 || y > 2100) throw new IllegalArgumentException("Année invalide : " + y);
        return y;
    }

    @GetMapping("/treasury")
    public TreasuryStatsDTO treasury(@RequestParam(required=false) Integer year){
        int y = annee(year);
        return svc.treasury(y);
    }

    @GetMapping("/membership")
    public MembershipStatsDTO membership(@RequestParam(required=false) Integer year){
        int y = annee(year);
        return svc.membership(y);
    }
}