package com.example.demo.config;

import com.example.demo.dtos.PersonDetailsDTO;
import com.example.demo.entities.Person;
import com.example.demo.services.PersonService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class ConsumerConfig {

    @Autowired
    PersonService personService;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_CREATE)
    public void handleUserCreation(PersonDetailsDTO person) {
        personService.insert(person);
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_DELETE)
    public void handleUserDeleted(UUID id) {
        personService.delete(id);
    }
}
