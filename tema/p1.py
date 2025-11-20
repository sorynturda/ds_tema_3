#!/usr/bin/env python
import pika
from pika import PlainCredentials
from time import sleep
from datetime import datetime, timedelta
import uuid
import random

cred = PlainCredentials(username="kalo", password="kalo")
connection = pika.BlockingConnection(
    pika.ConnectionParameters(host="localhost", credentials=cred),
)
channel = connection.channel()

channel.queue_declare(queue="tema_sd")

start_date = datetime(2025, 1, 1, 0, 0, 0)
cnt = 0

while True:
    d = {}
    d['did'] = str(uuid.uuid4())
    d['timestamp'] = start_date + timedelta(hours=cnt)
    if 8 < d['timestamp'].hour < 20:
        d['value'] = random.randint(100, 200)
    else:
        d['value'] = random.randint(50, 100)
    cnt += 1
    d['timestamp'] = str(d['timestamp'])
    channel.basic_publish(
        exchange="",
        routing_key="tema_sd",
        body = "P1: " + str(d)
    )

    print(f"P1: [x] {d}")
    sleep(random.randint(1,6))

