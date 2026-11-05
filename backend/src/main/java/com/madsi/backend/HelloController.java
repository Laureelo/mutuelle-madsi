package com.madsi.backend;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    // test rapide pour vérifier que l'appli démarre
    @GetMapping("/api/hello")
    public String hello(){
        return "Backend MADSI OK ✅";
    }
}
