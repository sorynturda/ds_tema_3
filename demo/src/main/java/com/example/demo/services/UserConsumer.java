package com.example.demo.services;

import com.example.demo.config.RabbitMQConfig;
import com.example.demo.dtos.PersonSyncDTO;
import com.example.demo.entities.Person;
import com.example.demo.repositories.PersonRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserConsumer {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserConsumer.class);
    private final PersonRepository personRepository;

    public UserConsumer(PersonRepository personRepository) {
        this.personRepository = personRepository;
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_CREATE)
    public void receiveUserCreation(PersonSyncDTO personSyncDTO) {
        try {
            LOGGER.info("Received user creation event for ID: {}", personSyncDTO.getId());
            Person person = new Person(
                    personSyncDTO.getId(),
                    personSyncDTO.getName(),
                    personSyncDTO.getAddress(),
                    personSyncDTO.getAge()
            );
            personRepository.save(person);
            LOGGER.info("User saved to database: {}", person.getId());
        } catch (Exception e) {
            LOGGER.error("Error processing user creation event", e);
        }
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_DELETE)
    public void receiveUserDeletion(UUID id) {
        try {
            LOGGER.info("Received user deletion event for ID: {}", id);
            if (personRepository.existsById(id)) {
                personRepository.deleteById(id);
                LOGGER.info("User deleted from database: {}", id);
            } else {
                LOGGER.warn("User with ID {} not found for deletion", id);
            }
        } catch (Exception e) {
            LOGGER.error("Error processing user deletion event", e);
        }
    }
}
