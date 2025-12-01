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

    public boolean createUser(PersonSyncDTO personSyncDTO) {
        try {
            Object response = rabbitTemplate.convertSendAndReceive(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.ROUTING_KEY_CREATED,
                    personSyncDTO,
                    message -> {
                        message.getMessageProperties().setExpiration("5000"); // 5 seconds TTL
                        return message;
                    }
            );
            LOGGER.info("[x] Sent user with ID: {}. Response: {}", personSyncDTO.getId(), response);
            return response != null && "OK".equals(response.toString());
        } catch (Exception e) {
            LOGGER.error("RPC call for createUser failed", e);
            return false;
        }
    }

    public boolean deleteUser(UUID id) {
        try {
            Object response = rabbitTemplate.convertSendAndReceive(
                    RabbitMQConfig.EXCHANGE_NAME,
                    RabbitMQConfig.ROUTING_KEY_DELETED,
                    id,
                    message -> {
                        message.getMessageProperties().setExpiration("5000"); // 5 seconds TTL
                        return message;
                    }
            );
            LOGGER.info("[x] Sent ID: {}. Response: {}", id, response);
            return response != null && "OK".equals(response.toString());
        } catch (Exception e) {
            LOGGER.error("RPC call for deleteUser failed", e);
            return false;
        }
    }

}