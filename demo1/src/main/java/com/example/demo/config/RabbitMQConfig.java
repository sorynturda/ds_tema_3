package com.example.demo.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String VALIDATION_QUEUE = "validate_queue";
    public static final String VALIDATION_EXCHANGE = "validate_exchange";
    public static final String VALIDATION_ROUTING_KEY = "validate_key";

    public static final String QUEUE_USER_CREATE = "user.queue.device-service.create";
    public static final String QUEUE_USER_DELETE = "user.queue.device-service.delete";

    public static final String USER_EXCHANGE = "user-exchange";
    public static final String DEVICE_EXCHANGE = "device-exchange";

    public static final String ROUTING_KEY_USER_CREATED = "user.created";
    public static final String ROUTING_KEY_USER_DELETED = "user.deleted";
    public static final String ROUTING_KEY_DEVICE_CREATED = "device.created";
    public static final String ROUTING_KEY_DEVICE_ASSIGNED = "device.assigned";
    public static final String ROUTING_KEY_DEVICE_UNASSIGNED = "device.unassigned";

    @Bean
    public Queue validateQueue() {
        return new Queue(VALIDATION_QUEUE, true);
    }

    @Bean
    public TopicExchange validateExchange() {
        return new TopicExchange(VALIDATION_EXCHANGE);
    }

    @Bean
    public Binding validateBinding(Queue validateQueue, TopicExchange validateExchange) {
        return BindingBuilder.bind(validateQueue).to(validateExchange).with(VALIDATION_ROUTING_KEY);
    }

    @Bean
    public Queue userCreateQueue() {
        return new Queue(QUEUE_USER_CREATE, true);
    }

    @Bean
    public Queue userDeleteQueue() {
        return new Queue(QUEUE_USER_DELETE, true);
    }

    @Bean
    public TopicExchange userExchange() {
        return new TopicExchange(USER_EXCHANGE);
    }

    @Bean
    public TopicExchange deviceExchange() {
        return new TopicExchange(DEVICE_EXCHANGE);
    }

    @Bean
    public Binding bindingUserCreated(Queue userCreateQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(userCreateQueue).to(userExchange).with(ROUTING_KEY_USER_CREATED);
    }

    @Bean
    public Binding bindingUserDeleted(Queue userDeleteQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(userDeleteQueue).to(userExchange).with(ROUTING_KEY_USER_DELETED);
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory connectionFactory) {
        final RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter());
        return rabbitTemplate;
    }
}
