package com.example.demo.services;

import com.example.demo.config.RabbitMQConfig;
import com.example.demo.dtos.PersonSyncDTO;
import com.example.demo.entities.User;
import com.example.demo.repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserConsumer {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserConsumer.class);
    private final UserRepository userRepository;

    public UserConsumer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_USER_CREATE)
    public void receiveUserCreation(PersonSyncDTO personSyncDTO) {
        try {
            LOGGER.info("Received user creation event for ID: {}", personSyncDTO.getId());
            User user = new User(personSyncDTO.getId());
            userRepository.save(user);
            LOGGER.info("User ID saved to database: {}", user.getId());
        } catch (Exception e) {
            LOGGER.error("Error processing user creation event", e);
        }
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_USER_DELETE)
    public void receiveUserDeletion(UUID id) {
        try {
            LOGGER.info("Received user deletion event for ID: {}", id);
            if (userRepository.existsById(id)) {
                userRepository.deleteById(id);
                LOGGER.info("User ID deleted from database: {}", id);
            } else {
                LOGGER.warn("User with ID {} not found for deletion", id);
            }
        } catch (Exception e) {
            LOGGER.error("Error processing user deletion event", e);
        }
    }
}
