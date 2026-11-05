package com.madsi.backend.security;

import com.madsi.backend.membres.MembreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DbUserDetailsService implements UserDetailsService {

    private final MembreRepository repo;

    /**
     * Charge le compte pour l'authentification. Un compte désactivé est volontairement chargé
     * normalement : c'est AuthController qui l'informe de la désactivation APRÈS vérification du
     * mot de passe (on ne révèle pas l'état d'un compte à quelqu'un qui n'en connaît pas le mot de passe).
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        var m = repo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Compte introuvable"));

        var role = AccountPolicy.effectiveRole(m);
        var auths = role == null
                ? List.<SimpleGrantedAuthority>of()
                : List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));

        return new User(m.getUsername(), m.getPassword(), auths);
    }
}
