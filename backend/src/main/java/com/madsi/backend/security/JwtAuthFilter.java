package com.madsi.backend.security;

import com.madsi.backend.membres.MembreRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authentifie chaque requête à partir du jeton JWT, puis relit le compte en base :
 * - un compte désactivé ou supprimé perd son accès immédiatement ;
 * - le rôle utilisé est celui de la base (un changement de rôle s'applique tout de suite),
 *   filtré par {@link AccountPolicy} (compte non activé = VISITEUR).
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwt;
    private final MembreRepository membres;

    public JwtAuthFilter(JwtUtil jwt, MembreRepository membres) {
        this.jwt = jwt;
        this.membres = membres;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith("Bearer ")) {
            try {
                String username = jwt.parse(header.substring(7)).getBody().getSubject();
                var membre = membres.findByUsername(username).orElse(null);
                var role = AccountPolicy.effectiveRole(membre);
                if (role != null) {
                    var auth = new UsernamePasswordAuthenticationToken(
                            membre.getUsername(), null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                // Jeton invalide ou expiré : requête non authentifiée (401 renvoyé par le point d'entrée)
            }
        }

        chain.doFilter(req, res);
    }
}
