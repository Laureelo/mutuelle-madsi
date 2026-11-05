package com.madsi.backend.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.stream.Collectors;

public final class CurrentUser {
    private CurrentUser(){}

    public static String username(){
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a == null ? null : String.valueOf(a.getPrincipal());
    }

    public static Set<String> roles(){
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null) return Set.of();
        return a.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority) // "ROLE_X"
                .map(r -> r.startsWith("ROLE_") ? r.substring(5) : r)
                .collect(Collectors.toSet());
    }

    public static boolean hasRole(String role){
        return roles().contains(role.startsWith("ROLE_") ? role.substring(5) : role);
    }
}