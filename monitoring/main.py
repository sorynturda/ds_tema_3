import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
from typing import List
import pika
import pika.exceptions
import json
import threading
import os
import uuid
import time
from dotenv import load_dotenv

from db_module import init_db, write_raw_data, get_daily_consumption, insert_device, insert_mapping, delete_mapping, check_mapping

load_dotenv()

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_USER = os.getenv('RABBITMQ_USER')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS')

DATA_EXCHANGE = 'data_collection_exchange'
MONITORING_QUEUE = 'monitoring_data_queue'
DATA_ROUTING_KEY = 'device.measurement'

DEVICE_EXCHANGE = 'device-exchange'
DEVICE_QUEUE = 'device.queue.monitoring-service'
DEVICE_ROUTING_KEY_CREATED = 'device.created'
DEVICE_ROUTING_KEY_ASSIGNED = 'device.assigned'
DEVICE_ROUTING_KEY_UNASSIGNED = 'device.unassigned'

CREDENTIALS = pika.credentials.PlainCredentials(username=RABBITMQ_USER, password=RABBITMQ_PASS)
CONN_PARAMS = pika.ConnectionParameters(
    host=RABBITMQ_HOST,
    port=5672,
    credentials=CREDENTIALS
)

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, device_id: str):
        await websocket.accept()
        if device_id not in self.active_connections:
            self.active_connections[device_id] = []
        self.active_connections[device_id].append(websocket)

    def disconnect(self, websocket: WebSocket, device_id: str):
        if device_id in self.active_connections:
            if websocket in self.active_connections[device_id]:
                self.active_connections[device_id].remove(websocket)
            if not self.active_connections[device_id]:
                del self.active_connections[device_id]

    async def broadcast(self, message: str, device_id: str):
        if device_id in self.active_connections:
            for connection in self.active_connections[device_id][:]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    print(f"[WS] Error sending message to device {device_id}: {e}")

manager = ConnectionManager()

@app.websocket("/ws/{user_id}/{device_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, device_id: str):
    await manager.connect(websocket, device_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, device_id)
    except Exception as e:
        print(f"[WS] Error: {e}")
        manager.disconnect(websocket, device_id)

@app.get("/monitoring/history/{device_id}")
async def get_history(device_id: str, date: str):
    """
    Returns hourly consumption for a given date.
    date format: YYYY-MM-DD
    """
    print(f"[MAIN] Fetching history for device {device_id} on {date}")
    data = get_daily_consumption(device_id, date)
    print(f"[MAIN] Returning {len(data)} data points")
    return data

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


hourly_consumption_store = {}

def get_hourly_consumption(device_id, timestamp_str, current_value):
    try:
        dt_part = timestamp_str.split(':')[0] # "YYYY-MM-DD HH"
        
        if device_id not in hourly_consumption_store:
            hourly_consumption_store[device_id] = {}
        
        if dt_part not in hourly_consumption_store[device_id]:
             hourly_consumption_store[device_id][dt_part] = 0.0
             
        hourly_consumption_store[device_id][dt_part] += current_value
        
        return hourly_consumption_store[device_id][dt_part]
    except Exception as e:
        print(f"[MAIN] Error calculating hourly consumption: {e}")
        return current_value

def process_measurement(data):
    """
    Extracts data, validates mapping via local DB, saves to DB, and broadcasts.
    """
    try:
        device_id = data['device_id']
        user_id = data['user_id']
        timestamp_str = data['timestamp']
        consumption = float(data['measurement_value'])

        # Local Validation
        is_valid = check_mapping(device_id, user_id)
        if not is_valid:
            print(f"[MAIN] Validation FAILED for Device {device_id} and User {user_id}. Device not mapped to user. Dropping data.")
            return

        write_raw_data(device_id, user_id, timestamp_str, consumption)
        print(f"[MAIN] Saved to DB: Device {device_id} | Time {timestamp_str}")
        
        message = json.dumps(data)
        asyncio.run_coroutine_threadsafe(manager.broadcast(message, device_id), loop)

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

def device_callback(ch, method, properties, body):
    try:
        data = json.loads(body.decode('utf-8'))
        routing_key = method.routing_key
        print(f"[MAIN] Received device event: {routing_key} | Data: {data}")
        
        if routing_key == DEVICE_ROUTING_KEY_CREATED:
            device_id = data.get('id')
            manufacturer = data.get('manufacturer')
            name = data.get('name')
            consumption = data.get('consumption')
            if device_id:
                insert_device(device_id, manufacturer, name, consumption)
                print(f"[MAIN] Device {device_id} created/updated.")

        elif routing_key == DEVICE_ROUTING_KEY_ASSIGNED:
            device_id = data.get('deviceId')
            user_id = data.get('userId')
            if device_id and user_id:
                insert_mapping(device_id, user_id)
                print(f"[MAIN] Device {device_id} assigned to User {user_id}.")

        elif routing_key == DEVICE_ROUTING_KEY_UNASSIGNED:
            # The body might be just the UUID string or a JSON with ID, depending on publisher.
            # Publisher sends just the UUID (as JSON string or plain? Jackson converts UUID to string usually).
            # Let's handle both object or simple string/value.
            device_id = data # Assuming it's deserialized to the UUID string directly if it was just a value
            # If it's a dict (unlikely for just UUID body but possible if wrapped), extract.
            if isinstance(data, dict):
                 device_id = data.get('id') or data.get('deviceId')
            
            if device_id:
                delete_mapping(device_id)
                print(f"[MAIN] Device {device_id} unassigned.")

        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"[MAIN] Error processing device event: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)


def start_data_consumer():
    try:
        connection = connect_to_rabbitmq()
        channel = connection.channel()

        # Data Queue
        channel.exchange_declare(exchange=DATA_EXCHANGE, exchange_type='direct', durable=True)
        channel.queue_declare(queue=MONITORING_QUEUE, durable=True)
        channel.queue_bind(
            exchange=DATA_EXCHANGE,
            queue=MONITORING_QUEUE,
            routing_key=DATA_ROUTING_KEY
        )

        # Device Queue
        channel.exchange_declare(exchange=DEVICE_EXCHANGE, exchange_type='topic', durable=True)
        channel.queue_declare(queue=DEVICE_QUEUE, durable=True)
        
        # Bind for all device events
        channel.queue_bind(exchange=DEVICE_EXCHANGE, queue=DEVICE_QUEUE, routing_key='device.#')

        print(f"[*] Waiting for messages on {MONITORING_QUEUE} and {DEVICE_QUEUE}. To exit press CTRL+C")

        channel.basic_consume(
            queue=MONITORING_QUEUE,
            on_message_callback=data_callback
        )
        
        channel.basic_consume(
            queue=DEVICE_QUEUE,
            on_message_callback=device_callback
        )

        channel.start_consuming()

    except pika.exceptions.AMQPConnectionError:
        print(f"[!!!] ERROR: Could not connect to RabbitMQ data broker at {RABBITMQ_HOST} after retries.")

    except KeyboardInterrupt:
        print("[INFO] Data Consumer stopping...")
    except Exception as e:
        print(f"[!!!] Unhandled error in data consumer: {e}")


@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()
    
    consumer_thread = threading.Thread(target=start_data_consumer)
    consumer_thread.daemon = True
    consumer_thread.start()
    print("[INFO] RabbitMQ Consumer thread started.")

def main():
    init_db()
    # RPC Client initialization removed
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == '__main__':
    main()