package com.madsi.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Sert l'application web (Angular) depuis le même serveur que l'API : les fichiers construits sont placés
 * dans classpath:/static/ lors de la construction (profil Maven « prod »).
 *
 * Les adresses de l'application (/login, /membres/12...) n'existent pas comme fichiers : le serveur renvoie
 * alors index.html et c'est Angular qui affiche la bonne page. Les adresses /api/... ne sont jamais concernées.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource demande = location.createRelative(resourcePath);
                        if (demande.exists() && demande.isReadable()) {
                            return demande;
                        }
                        if (resourcePath.startsWith("api/")) {
                            return null; // jamais de page pour une adresse d'API
                        }
                        Resource index = new ClassPathResource("/static/index.html");
                        return index.exists() ? index : null;
                    }
                });
    }
}
