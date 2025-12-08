package com.example.demo.dtos;

import java.io.Serializable;
import java.util.UUID;

public class DeviceSyncDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private UUID id;
    private String manufacturer;
    private String name; // Using 'name' as 'model' based on requirement description "name (device name)" but also "model" mentioned in "Publish to a device events exchange/queue with deviceId, manufacturer, model, and consumption". Assuming 'name' maps to 'model' or 'name'.
    private float consumption;

    public DeviceSyncDTO() {
    }

    public DeviceSyncDTO(UUID id, String manufacturer, String name, float consumption) {
        this.id = id;
        this.manufacturer = manufacturer;
        this.name = name;
        this.consumption = consumption;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public float getConsumption() {
        return consumption;
    }

    public void setConsumption(float consumption) {
        this.consumption = consumption;
    }
}
