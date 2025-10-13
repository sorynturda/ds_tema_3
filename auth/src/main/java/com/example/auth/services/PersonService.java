package com.example.auth.services;

import com.example.auth.dtos.PersonDTO;
import com.example.auth.dtos.builders.PersonBuilder;
import com.example.auth.entities.Person;
import com.example.auth.handlers.exceptions.model.ResourceNotFoundException;
import com.example.auth.repositories.PersonRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class PersonService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PersonService.class);
    private final PersonRepository personRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public PersonService(PersonRepository personRepository, PasswordEncoder passwordEncoder) {
        this.personRepository = personRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UUID insert(String username, String password) {
        Person person = personRepository.save(
                new Person(username, passwordEncoder.encode(password)));
        LOGGER.debug("Person with id {} was inserted in db", person.getId());
        return person.getId();
    }

}
