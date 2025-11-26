package com.example.auth.config;


import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String QUEUE_CREATE = "user.created.queue";
    public static final String QUEUE_DELETE = "user.deleted.queue";

    public static final String EXCHANGE_NAME = "auth-events-exchange";

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
    public DirectExchange exchange() {
        return new DirectExchange(EXCHANGE_NAME);
    }

    @Bean
    public Binding bindingCreated(Queue createQueue, DirectExchange exchange) {
        return BindingBuilder.bind(createQueue).to(exchange).with(ROUTING_KEY_CREATED);
    }

    @Bean
    public Binding bindingDeleted(Queue deleteQueue, DirectExchange exchange) {
        return BindingBuilder.bind(deleteQueue).to(exchange).with(ROUTING_KEY_DELETED);
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter());

        rabbitTemplate.setMandatory(true);

        rabbitTemplate.setReturnsCallback(returned -> {
            throw new RuntimeException("Message was returned by RabbitMQ: " + returned.getReplyText());
        });

        rabbitTemplate.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                throw new RuntimeException("Message was NOT confirmed by RabbitMQ: " + cause);
            }
        });

        return rabbitTemplate;
    }
}
