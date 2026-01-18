import os
import pika
import json
import hashlib
import time
from dotenv import load_dotenv

load_dotenv()

# Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbit')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'kalo')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'kalo')

# Incoming Data Config (same as original monitoring service)
DATA_EXCHANGE = 'data_collection_exchange'
INCOMING_QUEUE = 'device_data_queue' # LB consumes from here
DATA_ROUTING_KEY = 'device.measurement'

# Outgoing Config
MONITORING_EXCHANGE = 'monitoring_exchange'
MONITORING_QUEUE_PREFIX = 'monitoring_queue_'

NUM_REPLICAS = int(os.getenv('MONITORING_REPLICAS', 3))

CREDENTIALS = pika.credentials.PlainCredentials(username=RABBITMQ_USER, password=RABBITMQ_PASS)
CONN_PARAMS = pika.ConnectionParameters(host=RABBITMQ_HOST, port=5672, credentials=CREDENTIALS)

def connect_to_rabbitmq(retries=20, delay=5):
    for i in range(retries):
        try:
            connection = pika.BlockingConnection(CONN_PARAMS)
            return connection
        except pika.exceptions.AMQPConnectionError:
            print(f"[LB] Connection failed. Retrying in {delay}s... ({i+1}/{retries})")
            time.sleep(delay)
    raise Exception("Could not connect to RabbitMQ")

def get_replica_id(device_id: str) -> int:
    """Consistent hashing (simple modulus for now as replicas are static in this setup)"""
    hash_val = int(hashlib.md5(device_id.encode()).hexdigest(), 16)
    return hash_val % NUM_REPLICAS

def process_message(ch, method, properties, body):
    try:
        data = json.loads(body)
        device_id = data.get('device_id')
        
        if not device_id:
            print("[LB] Missing device_id, dropping message.")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        replica_id = get_replica_id(device_id)
        target_routing_key = f"replica.{replica_id}"
        
        # Forward to specific monitoring queue/routing key
        ch.basic_publish(
            exchange=MONITORING_EXCHANGE,
            routing_key=target_routing_key,
            body=body
        )
        print(f"[LB] Forwarded device {device_id} -> Replica {replica_id}")
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except Exception as e:
        print(f"[LB] Error: {e}")
        ch.basic_Nack(delivery_tag=method.delivery_tag, requeue=False)

def main():
    print("[LB] Starting Load Balancer Service...")
    connection = connect_to_rabbitmq()
    channel = connection.channel()

    # Declare Incoming
    channel.exchange_declare(exchange=DATA_EXCHANGE, exchange_type='direct', durable=True)
    channel.queue_declare(queue=INCOMING_QUEUE, durable=True)
    channel.queue_bind(exchange=DATA_EXCHANGE, queue=INCOMING_QUEUE, routing_key=DATA_ROUTING_KEY)

    # Declare Outgoing Exchange
    channel.exchange_declare(exchange=MONITORING_EXCHANGE, exchange_type='direct', durable=True)
    
    # Pre-declare queues for replicas to ensure they exist? 
    # Better if Replicas declare their own queues, but LB publishes to Exchange with Routing Key.
    
    print(f"[LB] Listening on {INCOMING_QUEUE}")
    channel.basic_consume(queue=INCOMING_QUEUE, on_message_callback=process_message)
    channel.start_consuming()

if __name__ == "__main__":
    main()
