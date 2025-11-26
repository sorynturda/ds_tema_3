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
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.ROUTING_KEY_CREATED,
                personSyncDTO
        );
        LOGGER.info("[x] Sent user with ID: {}", personSyncDTO.getId());
    }

    public void deleteUser(UUID id) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.ROUTING_KEY_DELETED,
                id
        );
        LOGGER.info("[x] Sent ID: {}", id);
    }

}