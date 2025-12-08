package com.example.demo.dtos;

import java.io.Serializable;
import java.util.UUID;

public class DeviceMappingDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID deviceId;
    private UUID userId;

    public DeviceMappingDTO() {
    }

    public DeviceMappingDTO(UUID deviceId, UUID userId) {
        this.deviceId = deviceId;
        this.userId = userId;
    }

    public UUID getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(UUID deviceId) {
        this.deviceId = deviceId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }
}
