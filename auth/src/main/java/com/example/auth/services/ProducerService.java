package com.example.auth.services;

import com.example.auth.config.RabbitMQConfig;
import com.example.auth.dtos.PersonSyncDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ProducerService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProducerService.class);
    private final RabbitTemplate rabbitTemplate;

    public ProducerService(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void createUser(PersonSyncDTO personSyncDTO) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.USER_EXCHANGE,
                    "user.created",
                    personSyncDTO
            );
            LOGGER.info("[x] Sent user creation event for ID: {}", personSyncDTO.getId());
        } catch (Exception e) {
            LOGGER.error("Failed to send user creation event", e);
        }
    }

    public void deleteUser(UUID id) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.USER_EXCHANGE,
                    "user.deleted",
                    id
            );
            LOGGER.info("[x] Sent user deletion event for ID: {}", id);
        } catch (Exception e) {
            LOGGER.error("Failed to send user deletion event", e);
        }
    }
}