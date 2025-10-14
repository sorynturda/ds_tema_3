package com.example.demo.controllers;

import com.example.demo.dtos.DeviceDTO;
import com.example.demo.dtos.DeviceDetailsDTO;
import com.example.demo.services.DeviceService;
import com.example.demo.services.JwtService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/devices")
@Validated
public class DeviceController {

    private final DeviceService deviceService;
    private final JwtService jwtService;

    public DeviceController(DeviceService deviceService, JwtService jwtService) {
        this.deviceService = deviceService;
        this.jwtService = jwtService;
    }

    @GetMapping
    public ResponseEntity<List<DeviceDTO>> getDevices(@RequestHeader("Authorization") String authHeader) {
        return ResponseEntity.ok(deviceService.findDevices());
    }

    @PostMapping
    public ResponseEntity<Void> create(@Valid @RequestBody DeviceDetailsDTO device) {
        UUID id = deviceService.insert(device);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(id)
                .toUri();
        return ResponseEntity.created(location).build(); // 201 + Location header
    }

    @GetMapping("/{id}")
    public ResponseEntity<DeviceDetailsDTO> getDevice(@PathVariable UUID id) {
        return ResponseEntity.ok(deviceService.findDevicesById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDevice(@PathVariable UUID id) {
        boolean deleted = deviceService.delete(id);
        if (deleted)
            return ResponseEntity.status(204).build();
        else
            return ResponseEntity.status(404).build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<DeviceDetailsDTO> updateDevice(@Valid @RequestBody DeviceDetailsDTO deviceDetailsDTO, @PathVariable UUID id) {
        DeviceDetailsDTO deviceDTO = deviceService.update(deviceDetailsDTO);
        if (id.equals(deviceDTO.getId())) {
            return ResponseEntity.status(204).body(deviceDTO);
        } else {
            URI location = ServletUriComponentsBuilder
                    .fromCurrentRequest()
                    .path("/{id}")
                    .buildAndExpand(deviceDTO.getId())
                    .toUri();
            return ResponseEntity.created(location).build();
        }
    }

}
