package com.madsi.backend.membres;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.madsi.backend.common.dto.PageResponse;
import com.madsi.backend.membres.dto.MembreCreateDTO;
import com.madsi.backend.membres.dto.MembreDTO;
import com.madsi.backend.membres.dto.MembreUpdateDTO;
import com.madsi.backend.security.AccessGuard;

import jakarta.validation.Valid;

/**
 * Gestion des membres. Les droits par rôle sont définis dans SecurityConfig :
 *  - liste des membres : trésorier, admin ;
 *  - création / modification / activation / rôle / suppression : admin ;
 *  - validation trésorerie : trésorier ;
 *  - consultation d'un membre : lui-même, ou trésorier / admin.
 *
 * L'identité de celui qui agit (adminId, tresorierId) est TOUJOURS déduite du jeton ;
 * les anciens paramètres envoyés par l'écran sont acceptés mais ignorés.
 */
@RestController
@RequestMapping("/api/membres")
public class MembreController {

    private final MembreService service;
    private final AccessGuard guard;
    private final EligibiliteService eligibilite;
    private final com.madsi.backend.settings.SettingsService settingsService;
    private final com.madsi.backend.prets.PretRepository pretRepo;

    public MembreController(MembreService service, AccessGuard guard, EligibiliteService eligibilite,
                            com.madsi.backend.settings.SettingsService settingsService,
                            com.madsi.backend.prets.PretRepository pretRepo) {
        this.service = service;
        this.guard = guard;
        this.eligibilite = eligibilite;
        this.settingsService = settingsService;
        this.pretRepo = pretRepo;
    }

    /**
     * GET /api/membres/{id}/situation : où en est le membre vis-à-vis de ses cotisations et de ses prêts
     * (soi-même, ou trésorier / admin).
     */
    @GetMapping("/{id}/situation")
    public Map<String, Object> situation(@PathVariable Long id) {
        guard.ensureSelfOrStaff(id);
        var impayes = eligibilite.moisImpayes(id);
        java.math.BigDecimal encours = java.math.BigDecimal.ZERO;
        for (var p : pretRepo.findByMembreIdOrderByIdDesc(id)) {
            var st = p.getStatut();
            if (st == com.madsi.backend.common.Enums.PretStatut.DEMANDE || st == com.madsi.backend.common.Enums.PretStatut.APPROUVE
                    || st == com.madsi.backend.common.Enums.PretStatut.EN_COURS) {
                var rembourse = p.getMontantRembourse() == null ? java.math.BigDecimal.ZERO : p.getMontantRembourse();
                var reste = p.getMontantAccorde().subtract(rembourse);
                if (reste.signum() > 0) encours = encours.add(reste);
            }
        }
        var plafond = settingsService.plafondEncoursPrets();
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("aJour", impayes.isEmpty());
        out.put("moisImpayes", impayes);
        out.put("nombreMoisImpayes", impayes.size());
        out.put("montantImpaye", settingsService.montantCotisation().multiply(java.math.BigDecimal.valueOf(impayes.size())));
        out.put("cotisationsAJourExigees", settingsService.exigerCotisationsAJour());
        out.put("encoursPrets", encours);
        out.put("plafondEncoursPrets", plafond);
        out.put("margePretDisponible", plafond.subtract(encours).max(java.math.BigDecimal.ZERO));
        out.put("seuilConfirmation", settingsService.seuilConfirmation());
        return out;
    }

    /** GET /api/membres?q=&etatCompte=&role=&page=&size= : liste paginée + recherche */
    @GetMapping
    public PageResponse<MembreDTO> search(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String etatCompte,
            @RequestParam(required = false) String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ){
        return service.search(q, etatCompte, role, Math.max(page, 0), Math.min(Math.max(size, 1), 1000));
    }

    /** GET /api/membres/{id} : détail (soi-même, ou trésorier / admin) */
    @GetMapping("/{id}")
    public MembreDTO get(@PathVariable Long id){
        guard.ensureSelfOrStaff(id);
        return service.get(id);
    }

    /** POST /api/membres : créer un nouveau membre (admin) */
    @PostMapping
    public MembreDTO create(@Valid @RequestBody MembreCreateDTO in){
        return service.create(in);
    }

    /** PUT /api/membres/{id} : modifier un compte (admin) */
    @PutMapping("/{id}")
    public MembreDTO update(@PathVariable Long id, @Valid @RequestBody MembreUpdateDTO in){
        return service.update(id, in);
    }

    /**
     * POST /api/membres/{id}/valider-tresorerie : validation par trésorerie (ancien flux)
     * Passe de EN_ATTENTE à VALIDE_PAR_TRESORERIE
     */
    @PostMapping("/{id}/valider-tresorerie")
    public MembreDTO validerParTresorerie(@PathVariable Long id,
                                          @RequestParam(required = false) Long tresorierId){
        return service.validerParTresorerie(id, guard.currentMembreId());
    }

    /** GET /api/membres/en-attente-activation : membres en attente d'activation (admin) */
    @GetMapping("/en-attente-activation")
    public List<MembreDTO> getMembresEnAttenteActivation() {
        return service.getMembresEnAttenteActivation();
    }

    /**
     * POST /api/membres/{id}/activer : activer le compte (admin)
     * Passe de VALIDE_PAR_TRESORERIE a ACTIF
     */
    @PostMapping("/{id}/activer")
    public MembreDTO activer(@PathVariable Long id,
                             @RequestParam(required = false) Long adminId) {
        return service.activerCompte(id, guard.currentMembreId());
    }

    /** POST /api/membres/{id}/reinitialiser-mot-de-passe : mot de passe provisoire à transmettre au membre (admin) */
    @PostMapping("/{id}/reinitialiser-mot-de-passe")
    public java.util.Map<String, String> reinitialiserMotDePasse(@PathVariable Long id) {
        return java.util.Map.of("motDePasseProvisoire", service.reinitialiserParAdmin(id, guard.currentMembreId()));
    }

    /** POST /api/membres/{id}/desactiver : passe le membre à INACTIF (admin) */
    @PostMapping("/{id}/desactiver")
    public MembreDTO desactiver(@PathVariable Long id,
                                @RequestParam(required = false) Long adminId){
        return service.desactiver(id, guard.currentMembreId());
    }

    /** POST /api/membres/{id}/reactiver : passe le membre à ACTIF (admin) */
    @PostMapping("/{id}/reactiver")
    public MembreDTO reactiver(@PathVariable Long id,
                               @RequestParam(required = false) Long adminId){
        return service.reactiver(id, guard.currentMembreId());
    }

    /**
     * POST /api/membres/{id}/role
     * body: { "role": "TRESORIER" }
     * -> change le rôle du membre (admin)
     */
    @PostMapping("/{id}/role")
    public MembreDTO changerRole(@PathVariable Long id,
                                 @RequestParam(required = false) Long adminId,
                                 @RequestBody Map<String,String> body){
        String roleStr = body.get("role");
        if (roleStr == null || roleStr.isBlank()) {
            throw new IllegalArgumentException("Le rôle est requis");
        }
        RoleMembre role;
        try {
            role = RoleMembre.valueOf(roleStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Rôle inconnu : " + roleStr);
        }
        return service.changerRole(id, role, guard.currentMembreId());
    }

    /** DELETE /api/membres/{id} : supprimer un membre sans données liées (admin) */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable Long id) {
        service.delete(id);
        return Map.of("status", "ok", "message", "Membre supprimé avec succès");
    }
}
