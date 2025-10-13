package com.example.auth.dtos;

import java.util.UUID;

public class PersonDTO {
    private UUID uuid;
    private String username;
    private String password;

    public PersonDTO(UUID uuid, String username, String password) {
        this.uuid = uuid;
        this.username = username;
        this.password = password;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public UUID getUuid() {
        return uuid;
    }

}
