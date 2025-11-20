#!/usr/bin/env python
import pika
from pika import PlainCredentials

cred = PlainCredentials(username="kalo", password="kalo")
connection = pika.BlockingConnection(
    pika.ConnectionParameters(host="localhost", credentials=cred),
)
channel = connection.channel()

channel.queue_declare(queue="tema_sd")

channel.basic_publish(exchange="", routing_key="tema_sd", body="Hello World!")
print(" [x] Sent 'Hello World!'")

connection.close()
