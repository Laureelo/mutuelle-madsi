package com.madsi.backend.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limite les tentatives de connexion échouées (protection contre les essais de mots de passe) :
 * 5 échecs consécutifs pour un même identifiant depuis une même adresse bloquent les nouvelles
 * tentatives pendant 15 minutes. Stockage en mémoire.
 */
@Service
public class LoginAttemptService {
    static final int MAX_ATTEMPTS = 5;
    static final Duration LOCK = Duration.ofMinutes(15);

    private record State(int failures, Instant lockedUntil) {}
    private final ConcurrentHashMap<String, State> states = new ConcurrentHashMap<>();

    public static String key(String username, String ip) {
        return (username == null ? "" : username.trim().toLowerCase(Locale.ROOT)) + "|" + ip;
    }

    /** Lève une exception si la clé est actuellement bloquée. */
    public void check(String key) {
        var s = states.get(key);
        if (s != null && s.lockedUntil() != null) {
            if (Instant.now().isBefore(s.lockedUntil())) {
                long minutes = Math.max(1, Duration.between(Instant.now(), s.lockedUntil()).toMinutes() + 1);
                throw new TooManyAttemptsException(
                        "Trop de tentatives échouées. Réessayez dans " + minutes + " minute(s).");
            }
            states.remove(key);
        }
    }

    public void failed(String key) {
        states.merge(key, new State(1, null), (old, ignored) -> {
            int n = old.failures() + 1;
            return n >= MAX_ATTEMPTS ? new State(n, Instant.now().plus(LOCK)) : new State(n, null);
        });
    }

    public void succeeded(String key) {
        states.remove(key);
    }

    public static class TooManyAttemptsException extends RuntimeException {
        public TooManyAttemptsException(String message) { super(message); }
    }
}
