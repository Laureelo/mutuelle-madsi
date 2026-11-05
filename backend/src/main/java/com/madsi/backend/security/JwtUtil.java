package com.madsi.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Key;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * Génération et lecture des jetons JWT.
 *
 * La clé de signature n'est JAMAIS écrite dans le code :
 *  1) elle est lue dans la variable d'environnement JWT_SECRET (propriété app.jwt.secret) si elle existe ;
 *  2) sinon une clé aléatoire est générée au premier démarrage et conservée dans data/jwt.secret
 *     (dossier ignoré par Git) afin que les connexions survivent aux redémarrages.
 */
@Component
public class JwtUtil {
    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);
    private static final Path SECRET_FILE = Path.of("data", "jwt.secret");

    private final Key key;
    private final long expirationMs;

    public JwtUtil(@Value("${app.jwt.secret:}") String configuredSecret,
                   @Value("${app.jwt.expiration-hours:12}") long expirationHours) {
        String secret = (configuredSecret == null || configuredSecret.isBlank())
                ? loadOrCreateSecret()
                : configuredSecret.trim();
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET trop court : 32 caractères minimum.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationHours * 60 * 60 * 1000L;
    }

    private static String loadOrCreateSecret() {
        try {
            if (Files.exists(SECRET_FILE)) {
                String s = Files.readString(SECRET_FILE, StandardCharsets.UTF_8).trim();
                if (s.length() >= 32) return s;
            }
            byte[] random = new byte[64];
            new SecureRandom().nextBytes(random);
            String s = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
            Files.createDirectories(SECRET_FILE.getParent());
            Files.writeString(SECRET_FILE, s, StandardCharsets.UTF_8);
            log.info("Clé JWT générée et enregistrée dans {} (ne jamais la partager).", SECRET_FILE.toAbsolutePath());
            return s;
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Impossible de créer la clé JWT. Définissez la variable d'environnement JWT_SECRET (32 caractères minimum).", e);
        }
    }

    public String generate(String subject, Map<String, Object> claims) {
        Date now = new Date();
        return Jwts.builder()
                .setSubject(subject)
                .addClaims(claims)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + expirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Jws<Claims> parse(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
    }
}
