package com.madsi.backend.security;

import com.madsi.backend.common.Enums;
import com.madsi.backend.membres.Membre;
import com.madsi.backend.membres.MembreRepository;
import com.madsi.backend.membres.MembreService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String MSG_IDENTIFIANTS = "Nom d'utilisateur ou mot de passe incorrect";

    private final AuthenticationManager authManager;
    private final JwtUtil jwt;
    private final MembreService membreService;
    private final MembreRepository membreRepository;
    private final LoginAttemptService loginAttempts;
    private final MotDePasseOublieService motDePasseOublie;

    // -------- REGISTER : crée un membre avec statut VISITEUR, password hashé
    @PostMapping("/register")
    public Map<String,Object> register(@RequestBody RegisterReq in){
        Membre saved = membreService.register(in.toServiceInput());
        return Map.of(
                "id", saved.getId(),
                "username", saved.getUsername(),
                "etatCompte", saved.getEtatCompte().name(),
                "message", "Compte créé avec statut VISITEUR. Réglez vos frais d'adhésion pour devenir membre actif."
        );
    }

    // -------- LOGIN : renvoie token + roles + id
    @PostMapping("/login")
    public Map<String,Object> login(@Valid @RequestBody LoginReq in, HttpServletRequest request){
        String key = LoginAttemptService.key(in.username(), request.getRemoteAddr());
        loginAttempts.check(key);

        try {
            authManager.authenticate(new UsernamePasswordAuthenticationToken(in.username(), in.password()));
        } catch (AuthenticationException e) {
            // Même message que l'identifiant existe ou non : on ne révèle pas quels comptes existent.
            loginAttempts.failed(key);
            throw new BadCredentialsException(MSG_IDENTIFIANTS);
        }
        loginAttempts.succeeded(key);

        Membre membre = membreRepository.findByUsername(in.username())
                .orElseThrow(() -> new BadCredentialsException(MSG_IDENTIFIANTS));

        // Mot de passe correct, mais compte désactivé par l'administrateur
        if (membre.getEtatCompte() == Enums.EtatCompte.INACTIF) {
            throw new DisabledException("Votre compte a été désactivé. Veuillez contacter l'administrateur.");
        }

        List<String> roles = List.of(AccountPolicy.effectiveRole(membre).name());
        String token = jwt.generate(membre.getUsername(), Map.of("roles", roles));
        return session(membre, roles, token);
    }

    // -------- ME : informations fraîches du compte connecté (rôle et état relus en base)
    @GetMapping("/me")
    public Map<String,Object> me(){
        String username = CurrentUser.username();
        if (username == null || "anonymousUser".equals(username)) {
            return Map.of("authenticated", false);
        }
        Membre membre = membreRepository.findByUsername(username).orElse(null);
        if (membre == null) return Map.of("authenticated", false);
        Map<String,Object> out = session(membre, List.copyOf(CurrentUser.roles()), null);
        out.put("authenticated", true);
        return out;
    }

    private static Map<String,Object> session(Membre m, List<String> roles, String token) {
        Map<String,Object> out = new LinkedHashMap<>();
        if (token != null) out.put("token", token);
        out.put("username", m.getUsername());
        out.put("roles", roles);
        out.put("id", m.getId());
        out.put("etatCompte", m.getEtatCompte().name());
        out.put("firstName", m.getFirstName());
        out.put("lastName", m.getLastName());
        return out;
    }

    // -------- MOT DE PASSE OUBLIÉ : réponse identique que le compte existe ou non
    @PostMapping("/mot-de-passe-oublie")
    public Map<String, String> motDePasseOublie(@RequestBody OubliReq in) {
        motDePasseOublie.demander(in.identifiant());
        return Map.of("message", "Si ce compte existe et que la messagerie est active, un lien de réinitialisation vient d'être envoyé. "
                + "Pensez à regarder vos courriers indésirables.");
    }

    @PostMapping("/reinitialiser-mot-de-passe")
    public Map<String, String> reinitialiser(@RequestBody ReinitReq in) {
        motDePasseOublie.reinitialiser(in.jeton(), in.motDePasse());
        return Map.of("message", "Mot de passe modifié. Vous pouvez vous connecter.");
    }

    // -------- DTOs
    public record OubliReq(String identifiant) {}
    public record ReinitReq(String jeton, String motDePasse) {}
    public record LoginReq(@NotBlank String username, @NotBlank String password) {}

    @Data
    public static class RegisterReq {
        private String firstName;
        private String lastName;
        private String email;
        private String phone;
        private String username;
        private String password;
        private String fonction;
        private String matriculeFonctionPublique;

        public MembreService.RegisterInput toServiceInput(){
            var in = new MembreService.RegisterInput();
            in.setFirstName(firstName);
            in.setLastName(lastName);
            in.setEmail(email);
            in.setPhone(phone);
            in.setUsername(username);
            in.setPassword(password);
            in.setFonction(fonction);
            in.setMatriculeFonctionPublique(matriculeFonctionPublique);
            return in;
        }
    }
}
