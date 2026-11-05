package com.madsi.backend.manifestations;

import com.madsi.backend.common.exception.NotFoundException;
import com.madsi.backend.manifestations.dto.TypeActiviteIn;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/types-activite")
@RequiredArgsConstructor
public class TypeActiviteController {

    private final TypeActiviteRepository repo;

    @GetMapping
    public List<TypeActivite> all(){
        return repo.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }

    @PostMapping
    public TypeActivite create(@Valid @RequestBody TypeActiviteIn in){
        var t = TypeActivite.builder()
                .libelle(in.libelle())
                .type(in.type())
                .sousType(in.sousType())
                .montantAlloue(in.montantAlloue())
                .lieu(in.lieu())
                .build();
        return repo.save(t);
    }

    @PutMapping("/{id}")
    public TypeActivite update(@PathVariable Long id, @Valid @RequestBody TypeActiviteIn in){
        var t = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("TypeActivite introuvable"));

        t.setLibelle(in.libelle());
        t.setType(in.type());
        t.setSousType(in.sousType());
        t.setMontantAlloue(in.montantAlloue());
        t.setLieu(in.lieu());

        return repo.save(t);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id){
        var t = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("TypeActivite introuvable"));
        repo.delete(t);
    }
}