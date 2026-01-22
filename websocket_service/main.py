import asyncio
import os
import json
import threading
from typing import List, Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import pika
import time
from dotenv import load_dotenv
from contextlib import asynccontextmanager

load_dotenv()

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbit')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'kalo')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'kalo')

BROADCAST_EXCHANGE = 'broadcast_exchange'

# 1. Define Manager first
class ConnectionManager:
    def __init__(self):
        # Map device_id -> list of websockets (for monitoring)
        self.device_connections: Dict[str, List[WebSocket]] = {}
        # Map user_id -> list of websockets (for chat)
        self.user_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, device_id: str = None):
        await websocket.accept()
        print(f"[WS] Accepted connection for user: {user_id}", flush=True)
        
        # Add to user connections
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)
        print(f"[WS] Active connections for user {user_id}: {len(self.user_connections[user_id])}", flush=True)
        
        # Add to device connections if provided
        if device_id:
            if device_id not in self.device_connections:
                self.device_connections[device_id] = []
            self.device_connections[device_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str, device_id: str = None):
        print(f"[WS] Disconnecting user: {user_id}", flush=True)
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        if device_id and device_id in self.device_connections:
            if websocket in self.device_connections[device_id]:
                self.device_connections[device_id].remove(websocket)
            if not self.device_connections[device_id]:
                del self.device_connections[device_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.user_connections:
            print(f"[WS] Sending personal message to user {user_id}, sockets: {len(self.user_connections[user_id])}", flush=True)
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_text(message)
                    print(f"[WS] Message sent to socket", flush=True)
                except Exception as e:
                    print(f"[WS] Failed to send to socket: {e}", flush=True)
        else:
            print(f"[WS] User {user_id} not found in connections. Active users: {list(self.user_connections.keys())}", flush=True)

    async def broadcast_to_device(self, message: str, device_id: str):
        if device_id in self.device_connections:
            for connection in self.device_connections[device_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass

manager = ConnectionManager()


# 2. Define Consumer (uses manager)
def rabbitmq_consumer(loop):
    while True:
        try:
            print("[WS] Attempting to connect to RabbitMQ...", flush=True)
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
            params = pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=credentials, heartbeat=600, blocked_connection_timeout=300)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()

            channel.exchange_declare(exchange=BROADCAST_EXCHANGE, exchange_type='fanout', durable=True)
            result = channel.queue_declare(queue='', exclusive=True)
            queue_name = result.method.queue
            channel.queue_bind(exchange=BROADCAST_EXCHANGE, queue=queue_name)

            def callback(ch, method, properties, body):
                message = body.decode()
                print(f"[WS] Received from RabbitMQ: {message}", flush=True)
                try:
                    data = json.loads(message)
                    
                    # Use thread-safe scheduling
                    if 'device_id' in data:
                        asyncio.run_coroutine_threadsafe(
                            manager.broadcast_to_device(message, data['device_id']), 
                            loop
                        )
                    
                    if 'user_id' in data:
                        if data.get('type') == 'chat' or data.get('type') == 'alert':
                            print(f"[WS] Broadcasting {data.get('type')} to user {data['user_id']}", flush=True)
                            asyncio.run_coroutine_threadsafe(
                                 manager.send_personal_message(message, data['user_id']), 
                                 loop
                             )
                except Exception as e:
                    print(f"Error broadcasting: {e}", flush=True)

            channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)
            print("[WS] Started RabbitMQ Consumer and listening...", flush=True)
            channel.start_consuming()
        
        except pika.exceptions.AMQPConnectionError as e:
            print(f"[WS] RabbitMQ Connection Error: {e}. Retrying in 5 seconds...", flush=True)
            time.sleep(5)
        except Exception as e:
            print(f"[WS] Unexpected RabbitMQ Error: {e}. Retrying in 5 seconds...", flush=True)
            time.sleep(5)


# 3. Define Lifespan (uses consumer)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    
    print("[WS] Starting RabbitMQ consumer thread (Lifespan)...", flush=True)
    try:
        t = threading.Thread(target=rabbitmq_consumer, args=(main_loop,))
        t.daemon = True
        t.start()
        print("[WS] RabbitMQ consumer thread started successfully", flush=True)
    except Exception as e:
        print(f"[WS] Failed to start RabbitMQ consumer thread: {e}", flush=True)
    
    yield
    
    print("[WS] Shutting down...", flush=True)


# 4. Create App (uses lifespan)
app = FastAPI(lifespan=lifespan)


# 5. Define Routes
@app.websocket("/ws/chat/{user_id}")
async def chat_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            pass 
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

@app.websocket("/ws/{user_id}/{device_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, device_id: str):
    await manager.connect(websocket, user_id, device_id)
    try:
        while True:
            data = await websocket.receive_text()
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, device_id)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
