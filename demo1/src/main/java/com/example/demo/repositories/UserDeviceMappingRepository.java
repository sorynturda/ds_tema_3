package com.example.demo.repositories;

import com.example.demo.entities.UserDeviceMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserDeviceMappingRepository extends JpaRepository<UserDeviceMapping, UUID> {
    Optional<UserDeviceMapping> findByUserIdAndDevice_Id(UUID userId, UUID deviceId);
    List<UserDeviceMapping> findByUserId(UUID userId);
}