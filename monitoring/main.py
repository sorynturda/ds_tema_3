import pika
import pika.exceptions
import json
import threading
import os
import uuid
import time
from dotenv import load_dotenv

from db_module import init_db, write_raw_data

load_dotenv()

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_USER = os.getenv('RABBITMQ_USER')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS')

DATA_EXCHANGE = 'data_collection_exchange'
MONITORING_QUEUE = 'monitoring_data_queue'
DATA_ROUTING_KEY = 'device.measurement'

VALIDATION_EXCHANGE = 'validate_exchange'
VALIDATION_ROUTING_KEY = 'validate_key'

CREDENTIALS = pika.credentials.PlainCredentials(username=RABBITMQ_USER, password=RABBITMQ_PASS)
CONN_PARAMS = pika.ConnectionParameters(
    host=RABBITMQ_HOST,
    port=5672,
    credentials=CREDENTIALS
)

def connect_to_rabbitmq(retries=10, delay=5):
    """Attempts to connect to RabbitMQ with retries."""
    for i in range(retries):
        try:
            connection = pika.BlockingConnection(CONN_PARAMS)
            return connection
        except pika.exceptions.AMQPConnectionError:
            print(f"[WARN] Connection to RabbitMQ at {RABBITMQ_HOST} failed. Retrying in {delay} seconds... ({i+1}/{retries})")
            time.sleep(delay)
    raise pika.exceptions.AMQPConnectionError(f"Failed to connect to RabbitMQ after {retries} attempts")


class RpcClient:
    def __init__(self):
        self.connection = connect_to_rabbitmq()
        self.channel = self.connection.channel()

        result = self.channel.queue_declare(queue='', exclusive=True)
        self.callback_queue = result.method.queue

        self.channel.basic_consume(
            queue=self.callback_queue,
            on_message_callback=self.on_response,
            auto_ack=True
        )

        self.response = None
        self.corr_id = None

    def on_response(self, ch, method, props, body):
        if self.corr_id == props.correlation_id:
            self.response = body

    def call(self, device_id, user_id):
        self.response = None
        self.corr_id = str(uuid.uuid4())
        
        message = json.dumps({"device_id": device_id, "user_id": user_id})

        self.channel.basic_publish(
            exchange=VALIDATION_EXCHANGE,
            routing_key=VALIDATION_ROUTING_KEY,
            properties=pika.BasicProperties(
                reply_to=self.callback_queue,
                correlation_id=self.corr_id,
                content_type='application/json',
                priority=0
            ),
            body=message
        )
        
        start_time = time.time()
        while self.response is None:
            self.connection.process_data_events()
            if time.time() - start_time > 5:
                print("[RPC] Timeout waiting for validation response")
                return False

        try:
            return self.response.decode('utf-8').lower() == 'true'
        except:
            return False


rpc_client = None

def process_measurement(data):
    """
    Extracts data, validates mapping via RPC, and calls the database module to persist the record.
    """
    global rpc_client
    try:
        device_id = data['device_id']
        user_id = data['user_id']
        timestamp_str = data['timestamp']
        consumption = float(data['measurement_value'])

        if rpc_client is None:
             rpc_client = RpcClient()

        is_valid = rpc_client.call(device_id, user_id)

        if is_valid:
            write_raw_data(device_id, user_id, timestamp_str, consumption)
            print(f"[MAIN] Processed: Device {device_id} | Time {timestamp_str}")
        else:
            print(f"[MAIN] Data Dumped: Invalid Mapping for Device {device_id} and User {user_id}")

    except Exception as e:
        print(f"[MAIN] ERROR processing/writing data: {e} | Raw Data: {data}")


def data_callback(ch, method, properties, body):
    try:
        data = json.loads(body.decode('utf-8'))
        process_measurement(data)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except json.JSONDecodeError:
        print(f"[MAIN] Failed to decode JSON: {body}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"[MAIN] Unhandled error in data callback: {e}. ACK'ing for now.")
        ch.basic_ack(delivery_tag=method.delivery_tag)


def start_data_consumer():
    try:
        connection = connect_to_rabbitmq()
        channel = connection.channel()

        channel.exchange_declare(exchange=DATA_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=MONITORING_QUEUE, durable=True)

        channel.queue_bind(
            exchange=DATA_EXCHANGE,
            queue=MONITORING_QUEUE,
            routing_key=DATA_ROUTING_KEY
        )

        print(f"[*] Waiting for data messages on {MONITORING_QUEUE}. To exit press CTRL+C")

        channel.basic_consume(
            queue=MONITORING_QUEUE,
            on_message_callback=data_callback
        )
        channel.start_consuming()

    except pika.exceptions.AMQPConnectionError:
        print(f"[!!!] ERROR: Could not connect to RabbitMQ data broker at {RABBITMQ_HOST} after retries.")

    except KeyboardInterrupt:
        print("[INFO] Data Consumer stopping...")
    except Exception as e:
        print(f"[!!!] Unhandled error in data consumer: {e}")


def main():
    init_db()
    
    global rpc_client
    try:
        rpc_client = RpcClient()
        print("[INFO] RPC Client initialized.")
    except Exception as e:
         print(f"[WARN] Failed to initialize RPC Client: {e}. Will retry in loop.")

    try:
        start_data_consumer()
    except KeyboardInterrupt:
        print("[INFO] Monitoring Microservice Shutdown Complete.")
    except Exception as e:
        print(f"[FATAL] Monitoring Microservice crashed: {e}")


if __name__ == '__main__':
    main()