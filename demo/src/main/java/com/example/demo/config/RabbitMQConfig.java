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

    public static final String QUEUE_CREATE = "user.queue.user-service.create";
    public static final String QUEUE_DELETE = "user.queue.user-service.delete";

    public static final String USER_EXCHANGE = "user-exchange";

    public static final String ROUTING_KEY_CREATED = "user.created";
    public static final String ROUTING_KEY_DELETED = "user.deleted";

    @Bean
    public Queue createQueue() {
        return new Queue(QUEUE_CREATE, true);
    }

    @Bean
    public Queue deleteQueue() {
        return new Queue(QUEUE_DELETE, true);
    }

    @Bean
    public TopicExchange userExchange() {
        return new TopicExchange(USER_EXCHANGE);
    }

    @Bean
    public Binding bindingCreated(Queue createQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(createQueue).to(userExchange).with(ROUTING_KEY_CREATED);
    }

    @Bean
    public Binding bindingDeleted(Queue deleteQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(deleteQueue).to(userExchange).with(ROUTING_KEY_DELETED);
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
