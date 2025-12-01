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

from db_module import init_db, write_raw_data, get_daily_consumption

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
    Extracts data, validates mapping via RPC, saves to DB, and broadcasts.
    """
    try:
        device_id = data['device_id']
        user_id = data['user_id']
        timestamp_str = data['timestamp']
        consumption = float(data['measurement_value'])

        if rpc_client:
            is_valid = rpc_client.call(device_id, user_id)
            if not is_valid:
                print(f"[MAIN] Validation FAILED for Device {device_id} and User {user_id}. Dropping data.")
                return
        else:
            print("[MAIN] RPC Client not initialized. Skipping validation (Risky).")

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
    
    global rpc_client
    try:
        rpc_client = RpcClient()
        print("[INFO] RPC Client initialized.")
    except Exception as e:
         print(f"[WARN] Failed to initialize RPC Client: {e}. Will retry in loop.")

    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == '__main__':
    main()