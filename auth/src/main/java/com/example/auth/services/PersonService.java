package com.example.auth.services;

import com.example.auth.dtos.RegisterDTO;
import com.example.auth.dtos.PersonSyncDTO;
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
import org.springframework.transaction.support.TransactionSynchronizationAdapter;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;
import java.util.UUID;

@Service
public class PersonService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PersonService.class);
    private final PersonRepository personRepository;
    private final PasswordEncoder passwordEncoder;
    private final RestTemplate restTemplate;
    private final ProducerService producerService;
    @Value("${user.service}")
    private String userServiceURL;

    @Autowired
    public PersonService(PersonRepository personRepository, PasswordEncoder passwordEncoder, RestTemplate restTemplate, ProducerService producerService) {
        this.personRepository = personRepository;
        this.passwordEncoder = passwordEncoder;
        this.restTemplate = restTemplate;
        this.producerService = producerService;
    }
    @Transactional
    public UUID insert(RegisterDTO user) {
        UUID newUserId = UUID.randomUUID();
        Person person = personRepository.save(
                new Person(newUserId, user.getUsername(), passwordEncoder.encode(user.getPassword()), false));
        LOGGER.debug("Person with id {} was inserted in db", person.getId());

        PersonSyncDTO userSyncRequest = new PersonSyncDTO(newUserId, user.getName(), user.getAddress(), user.getAge());

//        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronizationAdapter() {
//            @Override
//            public void afterCommit() {
//                try {
//                    producerService.createUser(userSyncRequest);
//                } catch (Exception e) {
//                    LOGGER.error("Failed to publish PersonSyncDTO for ID {}", newUserId, e);
//                }
//            }
//        });
        try{
            producerService.createUser(userSyncRequest);
        }
        catch (Exception e){
            LOGGER.error("Failed to publish PersonSyncDTO for ID {}", newUserId, e);
        }
        return person.getId();
    }

    public UUID getUserId(String username) {
        Optional<Person> person = personRepository.findByUsername(username);
        return person.get().getId();
    }

    public Person getPersonByUsernameAndAdmin(String username) {
        Optional<Person> person = personRepository.findPersonByUsernameAndAdmin(username);
        if (person.isEmpty()) {
            LOGGER.debug("Person with username {} does not have administrator rights", username);
            throw new ResourceNotFoundException("User is not");
        } else {
            LOGGER.debug("DEBUGDEBUG");
            return person.get();
        }
    }

    @Transactional
    public void deletePerson(UUID uuid) {
        personRepository.delete(personRepository.findById(uuid).get());
        try {
            producerService.deleteUser(uuid);
            LOGGER.debug("Person with id {} deleted successfully!", uuid);
        } catch (Exception e) {
            throw new RuntimeException("Error deleting person in user service: " + e.getMessage(), e);
        }
    }
}
