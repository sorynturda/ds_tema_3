package com.example.demo.services;

import com.example.demo.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class ValidationListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(ValidationListener.class);
    private final DeviceService deviceService;

    public ValidationListener(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @RabbitListener(queues = RabbitMQConfig.VALIDATION_QUEUE)
    public boolean validateMapping(Map<String, String> message) {
        try {
            String deviceIdStr = message.get("device_id");
            String userIdStr = message.get("user_id");

            LOGGER.info("Received validation request for Device: {} and User: {}", deviceIdStr, userIdStr);

            if (deviceIdStr == null || userIdStr == null) {
                return false;
            }

            UUID deviceId = UUID.fromString(deviceIdStr);
            UUID userId = UUID.fromString(userIdStr);

            boolean isValid = deviceService.checkMapping(deviceId, userId);
            LOGGER.info("Validation result for Device {} and User {}: {}", deviceId, userId, isValid);

            return isValid;

        } catch (Exception e) {
            LOGGER.error("Error processing validation request: {}", e.getMessage());
            return false;
        }
    }
}
