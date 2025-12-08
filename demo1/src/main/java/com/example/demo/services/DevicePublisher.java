package com.example.demo.services;

import com.example.demo.config.RabbitMQConfig;
import com.example.demo.dtos.DeviceMappingDTO;
import com.example.demo.dtos.DeviceSyncDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class DevicePublisher {

    private static final Logger LOGGER = LoggerFactory.getLogger(DevicePublisher.class);
    private final RabbitTemplate rabbitTemplate;

    public DevicePublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void createDevice(DeviceSyncDTO deviceSyncDTO) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.DEVICE_EXCHANGE,
                    RabbitMQConfig.ROUTING_KEY_DEVICE_CREATED,
                    deviceSyncDTO
            );
            LOGGER.info("[x] Sent device creation event for ID: {}", deviceSyncDTO.getId());
        } catch (Exception e) {
            LOGGER.error("Failed to send device creation event", e);
        }
    }

    public void assignDevice(DeviceMappingDTO mappingDTO) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.DEVICE_EXCHANGE,
                    RabbitMQConfig.ROUTING_KEY_DEVICE_ASSIGNED,
                    mappingDTO
            );
            LOGGER.info("[x] Sent device assignment event for Device {} and User {}", mappingDTO.getDeviceId(), mappingDTO.getUserId());
        } catch (Exception e) {
            LOGGER.error("Failed to send device assignment event", e);
        }
    }

    public void unassignDevice(UUID deviceId) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.DEVICE_EXCHANGE,
                    RabbitMQConfig.ROUTING_KEY_DEVICE_UNASSIGNED,
                    deviceId
            );
            LOGGER.info("[x] Sent device unassignment event for Device {}", deviceId);
        } catch (Exception e) {
            LOGGER.error("Failed to send device unassignment event", e);
        }
    }
}
