package com.example.demo.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String VALIDATION_QUEUE = "validate_queue";
    public static final String VALIDATION_EXCHANGE = "validate_exchange";
    public static final String VALIDATION_ROUTING_KEY = "validate_key";

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
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
