#!/usr/bin/env python
import os
import sys

import pika
from pika import PlainCredentials

def main():
    credentials = PlainCredentials(username="kalo", password="kalo")

    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host="localhost", credentials=credentials),
    )
    channel = connection.channel()

    channel.queue_declare(queue="tema_sd")

    def callback(ch, method, properties, body):
        print(f" [x] Received {body.decode()}")

    channel.basic_consume(
        queue="tema_sd",
        on_message_callback=callback,
        auto_ack=True,
    )

    print(" [*] Waiting for messages. To exit press CTRL+C")
    channel.start_consuming()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Interrupted")
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)
