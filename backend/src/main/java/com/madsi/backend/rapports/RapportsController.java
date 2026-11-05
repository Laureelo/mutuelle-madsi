// src/main/java/com/madsi/backend/rapports/RapportsController.java
package com.madsi.backend.rapports;

import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.rapports.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.io.File;

@RestController
@RequestMapping("/api/rapports")
@RequiredArgsConstructor
public class RapportsController {

    private final RapportsService service;
    private final RapportExportRepository repo;

    /** POST /api/rapports/generer */
    @PostMapping("/generer")
    public RapportExportDTO generer(@RequestBody RapportParamsDTO params){
        return service.generate(params);
    }

    /** GET /api/rapports/exports?page=&size= */
    @GetMapping("/exports")
    public PageResponse<RapportExportDTO> history(@RequestParam(defaultValue="0") int page,
                                                  @RequestParam(defaultValue="10") int size){
        return service.history(page, size);
    }

    /** GET /api/rapports/exports/{id}/file */
    @GetMapping("/exports/{id}/file")
    public ResponseEntity<FileSystemResource> download(@PathVariable Long id){
        var r = repo.findById(id).orElseThrow(() -> new com.madsi.backend.common.exception.NotFoundException("Rapport introuvable"));
        var f = new File(r.getFichierPath());
        if (!f.exists()) return ResponseEntity.notFound().build();

        String filename = service.nomFichier(r);
        MediaType mt;
        switch (r.getFormat()) {
            case "PDF":
                mt = MediaType.APPLICATION_PDF;
                break;
            case "XLSX":
                mt = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                break;
            case "CSV":
            default:
                mt = MediaType.parseMediaType("text/csv; charset=UTF-8");
                break;
        }

        return ResponseEntity.ok()
                .contentType(mt)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(new FileSystemResource(f));
    }
}
