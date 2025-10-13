package com.example.auth.controller;

import java.net.URI;
import java.time.Instant;
import java.util.UUID;
import java.util.stream.Collectors;

import com.example.auth.dtos.PersonDTO;
import com.example.auth.dtos.RegisterDTO;
import com.example.auth.services.PersonService;
import jakarta.validation.Valid;
import org.apache.coyote.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * A controller for the token resource.
 *
 * @author Josh Cummings
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    PersonService personService;

    @Autowired
    JwtEncoder encoder;

    @PostMapping("/register")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterDTO registerDTO) {
        UUID id = personService.insert(registerDTO.getUsername(), registerDTO.getPassword());
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(id)
                .toUri();
        return ResponseEntity.created(location).build();
    }


    @PostMapping("/token")
    public String token(Authentication authentication) {
        Instant now = Instant.now();
        long expiry = 20L;
        // @formatter:off
        String scope = authentication.getAuthorities().stream()
              .map(GrantedAuthority::getAuthority)
              .collect(Collectors.joining(" "));
        JwtClaimsSet claims = JwtClaimsSet.builder()
              .issuer("self")
              .issuedAt(now)
              .expiresAt(now.plusSeconds(expiry))
              .subject(authentication.getName())
              .claim("scope", scope)
              .build();
        // @formatter:on
        return this.encoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
    }

}