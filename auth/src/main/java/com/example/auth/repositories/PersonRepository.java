package com.example.auth.repositories;

import com.example.auth.entities.Person;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface PersonRepository extends JpaRepository<Person, UUID> {
    @Query
    Optional<Person> findByUsername(String username);
}

