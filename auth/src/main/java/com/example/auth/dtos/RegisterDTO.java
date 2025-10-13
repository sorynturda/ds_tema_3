package com.example.auth.dtos;

import com.example.auth.dtos.annotation.validators.UsernameRestriction;
import jakarta.validation.constraints.NotBlank;

public class RegisterDTO {
    @NotBlank(message = "username is required")
    @UsernameRestriction()
    private String username;
    @NotBlank(message = "password is required")
    private String password;

    public RegisterDTO(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }
}
