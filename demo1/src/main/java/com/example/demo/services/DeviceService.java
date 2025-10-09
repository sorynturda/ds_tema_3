package com.example.demo.services;


import com.example.demo.dtos.DeviceDTO;
import com.example.demo.dtos.DeviceDetailsDTO;
import com.example.demo.dtos.builders.DeviceBuilder;
import com.example.demo.entities.Device;
import com.example.demo.handlers.exceptions.model.ResourceNotFoundException;
import com.example.demo.repositories.DeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DeviceService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DeviceService.class);
    private final DeviceRepository deviceRepository;

    @Autowired
    public DeviceService(DeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }

    public List<DeviceDTO> findDevices() {
        List<Device> deviceList = deviceRepository.findAll();
        return deviceList.stream()
                .map(DeviceBuilder::toDeviceDTO)
                .collect(Collectors.toList());
    }

    public DeviceDetailsDTO findDevicesById(UUID id) {
        Optional<Device> prosumerOptional = deviceRepository.findById(id);
        if (prosumerOptional.isEmpty()) {
            LOGGER.error("Device with id {} was not found in db", id);
            throw new ResourceNotFoundException(Device.class.getSimpleName() + " with id: " + id);
        }
        return DeviceBuilder.toDeviceDetailsDTO(prosumerOptional.get());
    }

    public UUID insert(DeviceDetailsDTO deviceDTO) {
        Device device = DeviceBuilder.toEntity(deviceDTO);
        device = deviceRepository.save(device);
        LOGGER.debug("Device with id {} was inserted in db", device.getId());
        return device.getId();
    }
    public DeviceDetailsDTO update(DeviceDetailsDTO deviceDTO) {
        Optional<Device> optionalDevice = deviceRepository.findById(deviceDTO.getId());
        if (optionalDevice.isPresent()){
            Device device = optionalDevice.get();
            device.setManufacturer(deviceDTO.getManufacturer());
            device.setName(deviceDTO.getName());
            device.setConsumption(deviceDTO.getConsumption());
            device = deviceRepository.save(device);
            LOGGER.debug("Device with id {} was updated in db", device.getId());
            return DeviceBuilder.toDeviceDetailsDTO(device);
        }
        else{
            LOGGER.debug("Device with id {} was inserted in db", deviceDTO.getId());
            return DeviceBuilder.toDeviceDetailsDTO(deviceRepository.save(DeviceBuilder.toEntity(deviceDTO)));
        }
    }

    public boolean delete(UUID id){
        Optional <Device> deviceOptional = deviceRepository.findById(id);
        if(deviceOptional.isPresent()){
            deviceRepository.delete(deviceOptional.get());
            LOGGER.debug("Device with id {} was deleted from db", id);
            return true;
        }else {
            LOGGER.debug("Device with id {} was not deleted from db",id);
            return false;
        }
    }
}
