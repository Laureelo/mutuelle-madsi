package com.madsi.backend.security;

import com.madsi.backend.membres.MembreRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.nio.charset.StandardCharsets;

/**
 * Grille d'accès de l'application, par rôle.
 *
 * Rôles : VISITEUR < MEMBRE < TRESORIER / COMMISSAIRE < ADMIN.
 * (Voir la matrice des droits dans le README.)
 *
 * Deux niveaux de contrôle :
 *  1) ici, par URL et par rôle ;
 *  2) dans les contrôleurs, via {@link AccessGuard}, pour qu'un membre n'accède qu'à SES données.
 *
 * Attention : Spring applique la PREMIÈRE règle qui correspond, donc les règles précises
 * doivent rester placées avant les règles générales.
 */
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    private static final String[] ACTIFS = Roles.ACTIFS;                       // MEMBRE, TRESORIER, COMMISSAIRE, ADMIN
    private static final String[] LECTEURS_FINANCES = Roles.LECTEURS_FINANCES; // TRESORIER, COMMISSAIRE, ADMIN
    private static final String[] CONSULTENT_MEMBRES = Roles.CONSULTENT_MEMBRES; // TRESORIER, ADMIN
    private static final String[] GERENT_MANIFESTATIONS = {Roles.TRESORIER, Roles.ADMIN};
    private static final String[] COMMUNIQUENT = {Roles.TRESORIER, Roles.ADMIN};
    private static final String[] STATS_ACTIVITES = {Roles.TRESORIER, Roles.COMMISSAIRE, Roles.ADMIN};

    private final JwtUtil jwt;
    private final UserDetailsService uds;
    private final PasswordEncoder passwordEncoder;
    private final CorsConfigurationSource corsConfigurationSource;
    private final MembreRepository membres;

    public SecurityConfig(JwtUtil jwt, UserDetailsService uds, PasswordEncoder passwordEncoder,
                          CorsConfigurationSource corsConfigurationSource, MembreRepository membres) {
        this.jwt = jwt;
        this.uds = uds;
        this.passwordEncoder = passwordEncoder;
        this.corsConfigurationSource = corsConfigurationSource;
        this.membres = membres;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        var jwtFilter = new JwtAuthFilter(jwt, membres);

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh
                        // Pas de jeton / jeton expiré -> 401 (l'écran renvoie alors vers la connexion)
                        .authenticationEntryPoint((req, res, ex) ->
                                writeJson(res, 401, "UNAUTHORIZED", "Session expirée ou absente. Veuillez vous reconnecter."))
                        // Connecté mais pas le droit -> 403
                        .accessDeniedHandler((req, res, ex) ->
                                writeJson(res, 403, "FORBIDDEN", "Vous n'avez pas le droit d'effectuer cette action.")))
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // ============ PUBLIC ============
                        .requestMatchers("/", "/index.html", "/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register",
                                "/api/auth/mot-de-passe-oublie", "/api/auth/reinitialiser-mot-de-passe").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").permitAll() // renvoie authenticated:false sans jeton
                        .requestMatchers(HttpMethod.GET, "/api/settings/public").permitAll()
                        .requestMatchers("/api/hello").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()

                        // ============ PROFIL PERSONNEL (tout compte connecté, visiteur compris) ============
                        .requestMatchers("/api/profil/**").authenticated()

                        // ============ ADHÉSIONS ============
                        .requestMatchers(HttpMethod.POST, "/api/adhesions/declarer").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/adhesions/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/adhesions/*/valider", "/api/adhesions/*/rejeter").hasRole(Roles.TRESORIER)
                        .requestMatchers(HttpMethod.GET, "/api/adhesions", "/api/adhesions/**").hasAnyRole(Roles.TRESORIER, Roles.ADMIN)
                        .requestMatchers("/api/paiements-adhesion/**").hasAnyRole(Roles.TRESORIER, Roles.ADMIN)

                        // ============ MEMBRES ============
                        .requestMatchers(HttpMethod.GET, "/api/membres/en-attente-activation").hasRole(Roles.ADMIN)
                        .requestMatchers(HttpMethod.GET, "/api/membres").hasAnyRole(CONSULTENT_MEMBRES)
                        .requestMatchers(HttpMethod.GET, "/api/membres/*", "/api/membres/*/situation").authenticated() // soi-même ou bureau/trésorier/admin (AccessGuard)
                        .requestMatchers(HttpMethod.POST, "/api/membres/*/valider-tresorerie").hasRole(Roles.TRESORIER)
                        .requestMatchers(HttpMethod.POST, "/api/membres", "/api/membres/**").hasRole(Roles.ADMIN)
                        .requestMatchers(HttpMethod.PUT, "/api/membres/**").hasRole(Roles.ADMIN)
                        .requestMatchers(HttpMethod.DELETE, "/api/membres/**").hasRole(Roles.ADMIN)
                        .requestMatchers(HttpMethod.GET, "/api/historiques").authenticated() // soi-même ou bureau/trésorier/admin (AccessGuard)

                        // ============ COTISATIONS ============
                        .requestMatchers(HttpMethod.POST, "/api/cotisations/declarer").hasAnyRole(ACTIFS) // soi-même ou trésorier (AccessGuard)
                        .requestMatchers(HttpMethod.GET, "/api/cotisations/arrieres").hasAnyRole(COMMUNIQUENT) // suivi et relances
                        .requestMatchers(HttpMethod.GET, "/api/cotisations/toutes", "/api/cotisations/en-attente",
                                "/api/cotisations/admin", "/api/cotisations/retards", "/api/cotisations/total/**")
                                .hasAnyRole(LECTEURS_FINANCES)
                        .requestMatchers(HttpMethod.GET, "/api/cotisations", "/api/cotisations/mes-cotisations",
                                "/api/cotisations/mois-non-payes", "/api/cotisations/membre/*",
                                "/api/cotisations/exists/**", "/api/cotisations/*", "/api/cotisations/*/recu")
                                .hasAnyRole(ACTIFS) // soi-même ou lecteur des finances (AccessGuard)
                        .requestMatchers(HttpMethod.POST, "/api/cotisations", "/api/cotisations/**").hasRole(Roles.TRESORIER)
                        .requestMatchers(HttpMethod.PUT, "/api/cotisations/**").hasRole(Roles.TRESORIER)
                        .requestMatchers(HttpMethod.DELETE, "/api/cotisations/**").hasRole(Roles.TRESORIER)

                        // ============ PREUVES DE PAIEMENT (images à la demande) ============
                        .requestMatchers(HttpMethod.GET, "/api/preuves/*/*").authenticated() // propriétaire ou lecteur des finances (AccessGuard)

                        // ============ PRÊTS, ÉCHÉANCES, REMBOURSEMENTS ============
                        .requestMatchers(HttpMethod.POST, "/api/prets").hasAnyRole(ACTIFS) // soi-même ou trésorier (AccessGuard)
                        .requestMatchers(HttpMethod.POST, "/api/prets/*/confirmer").hasRole(Roles.ADMIN) // le président confirme les gros prêts
                        .requestMatchers(HttpMethod.POST, "/api/prets/**").hasRole(Roles.TRESORIER) // valider, approuver, refuser, rejeter, verser
                        .requestMatchers(HttpMethod.GET, "/api/prets").hasAnyRole(LECTEURS_FINANCES)
                        .requestMatchers(HttpMethod.GET, "/api/prets/**").hasAnyRole(ACTIFS) // soi-même ou lecteur des finances (AccessGuard)
                        .requestMatchers(HttpMethod.GET, "/api/echeances/**").hasAnyRole(ACTIFS) // propriétaire du prêt ou lecteur des finances
                        .requestMatchers(HttpMethod.POST, "/api/remboursements/mobile/submit").hasAnyRole(ACTIFS) // propriétaire de l'échéance
                        .requestMatchers(HttpMethod.GET, "/api/remboursements/*/recu").hasAnyRole(ACTIFS) // propriétaire ou lecteur des finances
                        .requestMatchers(HttpMethod.POST, "/api/remboursements", "/api/remboursements/**").hasRole(Roles.TRESORIER)
                        .requestMatchers(HttpMethod.GET, "/api/remboursements/**").hasAnyRole(LECTEURS_FINANCES)

                        // ============ OPÉRATIONS FINANCIÈRES & REÇUS ============
                        // Reçus : tout compte connecté, y compris un adhérent pas encore activé (statuts art. 20) ;
                        // AccessGuard limite ensuite au propriétaire du reçu ou aux lecteurs des finances.
                        .requestMatchers(HttpMethod.GET, "/api/operations/*/recu", "/api/operations/*/recu/pdf", "/api/recus/*/pdf").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/prets/*/recu-versement").hasAnyRole(ACTIFS)
                        .requestMatchers(HttpMethod.GET, "/api/operations", "/api/operations/**").hasAnyRole(LECTEURS_FINANCES)
                        .requestMatchers(HttpMethod.POST, "/api/operations/*/confirmer", "/api/operations/*/refuser").hasRole(Roles.ADMIN) // le président
                        .requestMatchers(HttpMethod.POST, "/api/caisse/**", "/api/operations/**").hasRole(Roles.TRESORIER)

                        // ============ CONFIRMATIONS DU PRÉSIDENT (alerte du tableau de bord) ============
                        .requestMatchers(HttpMethod.GET, "/api/confirmations/en-attente").hasRole(Roles.ADMIN)

                        // ============ MANIFESTATIONS ============
                        .requestMatchers(HttpMethod.GET, "/api/manifestations", "/api/manifestations/**").hasAnyRole(ACTIFS)
                        .requestMatchers(HttpMethod.POST, "/api/manifestations").hasAnyRole(ACTIFS)
                        .requestMatchers(HttpMethod.POST, "/api/manifestations/*/participer").hasAnyRole(ACTIFS)
                        .requestMatchers(HttpMethod.PUT, "/api/manifestations/*/participer").hasAnyRole(ACTIFS)
                        .requestMatchers(HttpMethod.DELETE, "/api/manifestations/*/participer").hasAnyRole(ACTIFS)
                        .requestMatchers(HttpMethod.POST, "/api/manifestations/*/annuler").hasAnyRole(ACTIFS) // déclarant uniquement (service)
                        .requestMatchers(HttpMethod.POST, "/api/manifestations/*/valider", "/api/manifestations/*/rejeter")
                                .hasAnyRole(GERENT_MANIFESTATIONS)
                        .requestMatchers(HttpMethod.POST, "/api/manifestations/*/cloturer").hasRole(Roles.TRESORIER)
                        .requestMatchers(HttpMethod.PUT, "/api/manifestations/**").hasAnyRole(GERENT_MANIFESTATIONS)
                        .requestMatchers(HttpMethod.DELETE, "/api/manifestations/**").hasRole(Roles.ADMIN)

                        // ============ TYPES D'ACTIVITÉ ============
                        .requestMatchers(HttpMethod.GET, "/api/types-activite", "/api/types-activite/**").hasAnyRole(ACTIFS)
                        .requestMatchers("/api/types-activite/**").hasRole(Roles.ADMIN)

                        // ============ STATISTIQUES & RAPPORTS ============
                        .requestMatchers(HttpMethod.GET, "/api/stats/treasury", "/api/stats/treasury/**").hasAnyRole(LECTEURS_FINANCES)
                        .requestMatchers(HttpMethod.GET, "/api/stats/membership", "/api/stats/membership/**").hasAnyRole(STATS_ACTIVITES)
                        .requestMatchers(HttpMethod.POST, "/api/rapports/**").hasAnyRole(LECTEURS_FINANCES)
                        .requestMatchers(HttpMethod.GET, "/api/rapports/**").hasAnyRole(LECTEURS_FINANCES)

                        // ============ NOTIFICATIONS ============
                        .requestMatchers("/api/notifications", "/api/notifications/**").hasAnyRole(ACTIFS) // ses propres notifications (AccessGuard)
                        .requestMatchers(HttpMethod.POST, "/api/annonces").hasAnyRole(COMMUNIQUENT)

                        // ============ ADMINISTRATION ============
                        .requestMatchers(HttpMethod.GET, "/api/admin/sante").hasRole(Roles.ADMIN)
                        .requestMatchers("/api/admin/email", "/api/admin/email/**").hasRole(Roles.ADMIN)
                        .requestMatchers(HttpMethod.GET, "/api/settings/meta").hasAnyRole(Roles.TRESORIER, Roles.ADMIN)
                        .requestMatchers(HttpMethod.GET, "/api/settings", "/api/settings/**").authenticated()
                        .requestMatchers("/api/settings", "/api/settings/**").hasRole(Roles.ADMIN)

                        // Toute adresse d'API non listée ci-dessus est refusée (principe du moindre privilège)
                        .requestMatchers("/api/**").denyAll()

                        // Pages et fichiers de l'application web (aucune donnée : l'accès aux données passe par /api)
                        .anyRequest().permitAll()
                )
                .userDetailsService(uds)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private static void writeJson(HttpServletResponse res, int status, String code, String message) throws java.io.IOException {
        res.setStatus(status);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String safe = message.replace("\\", "\\\\").replace("\"", "\\\"");
        res.getWriter().write("{\"status\":" + status + ",\"error\":\"" + code + "\",\"message\":\"" + safe + "\"}");
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(uds);
        authProvider.setPasswordEncoder(passwordEncoder);
        // hideUserNotFoundExceptions reste à true (défaut) : un identifiant inconnu et un mot de passe
        // faux donnent la même erreur.
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}
