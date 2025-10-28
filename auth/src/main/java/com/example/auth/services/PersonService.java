package com.example.auth.services;

import com.example.auth.dtos.PersonDTO;
import com.example.auth.dtos.RegisterDTO;
import com.example.auth.dtos.builders.PersonBuilder;
import com.example.auth.dtos.builders.PersonSyncDTO;
import com.example.auth.entities.Person;
import com.example.auth.handlers.exceptions.model.ResourceNotFoundException;
import com.example.auth.repositories.PersonRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;
import java.util.UUID;

@Service
public class PersonService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PersonService.class);
    private final PersonRepository personRepository;
    private final PasswordEncoder passwordEncoder;
    private final RestTemplate restTemplate;
    @Value("${user.service}")
    private String userServiceURL;
    @Autowired
    public PersonService(PersonRepository personRepository, PasswordEncoder passwordEncoder, RestTemplate restTemplate) {
        this.personRepository = personRepository;
        this.passwordEncoder = passwordEncoder;
        this.restTemplate = restTemplate;
    }

    public UUID insert(RegisterDTO user) {
        UUID newUserId = UUID.randomUUID();
        Person person = personRepository.save(
                new Person(newUserId, user.getUsername(), passwordEncoder.encode(user.getPassword()), false));
        LOGGER.debug("Person with id {} was inserted in db", person.getId());

        PersonSyncDTO userSyncRequest = new PersonSyncDTO(newUserId, user.getName(), user.getAddress(), user.getAge());
        try {
            String userServiceUrl = userServiceURL + "/people";
            restTemplate.postForObject(userServiceUrl, userSyncRequest, Void.class);

        } catch (Exception e) {
            personRepository.deleteById(newUserId);
            throw new RuntimeException("Error creating user: " + e.getMessage());
        }
        return person.getId();
    }

    public UUID getUserId(String username){
        Optional<Person> person = personRepository.findByUsername(username);
        return person.get().getId();
    }
}
