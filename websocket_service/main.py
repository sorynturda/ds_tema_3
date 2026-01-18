import asyncio
import os
import json
import threading
from typing import List, Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import pika
from dotenv import load_dotenv

load_dotenv()

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbit')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'kalo')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'kalo')

BROADCAST_EXCHANGE = 'broadcast_exchange'

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        # Map device_id -> list of websockets (for monitoring)
        self.device_connections: Dict[str, List[WebSocket]] = {}
        # Map user_id -> list of websockets (for chat)
        self.user_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, device_id: str = None):
        await websocket.accept()
        
        # Add to user connections
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)
        
        # Add to device connections if provided
        if device_id:
            if device_id not in self.device_connections:
                self.device_connections[device_id] = []
            self.device_connections[device_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str, device_id: str = None):
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
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass

    async def broadcast_to_device(self, message: str, device_id: str):
        if device_id in self.device_connections:
            for connection in self.device_connections[device_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass

manager = ConnectionManager()

# RabbitMQ Consumer
def rabbitmq_consumer():
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        params = pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=credentials)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()

        channel.exchange_declare(exchange=BROADCAST_EXCHANGE, exchange_type='fanout', durable=True)
        result = channel.queue_declare(queue='', exclusive=True)
        queue_name = result.method.queue
        channel.queue_bind(exchange=BROADCAST_EXCHANGE, queue=queue_name)

        def callback(ch, method, properties, body):
            message = body.decode()
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                data = json.loads(message)
                # Determine destination
                # If it has device_id, send to device subscribers
                if 'device_id' in data:
                    asyncio.run(manager.broadcast_to_device(message, data['device_id']))
                
                # If it has user_id (chat message), send to user
                if 'user_id' in data: # Note: monitoring data also has user_id, but usually we filter by type or source
                    # For chat, we might want a specific flag or type
                    if data.get('type') == 'chat':
                         asyncio.run(manager.send_personal_message(message, data['user_id']))
                    # If it's monitoring data, we might also want to send to user personally? 
                    # Existing frontend listens to /ws/{user}/{device}, so broadcast_to_device covers it.
            except Exception as e:
                print(f"Error broadcasting: {e}")

        channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)
        print("[WS] Started RabbitMQ Consumer")
        channel.start_consuming()
    except Exception as e:
        print(f"[WS] RabbitMQ Error: {e}")

@app.on_event("startup")
async def startup_event():
    t = threading.Thread(target=rabbitmq_consumer)
    t.daemon = True
    t.start()

@app.websocket("/ws/{user_id}/{device_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, device_id: str):
    await manager.connect(websocket, user_id, device_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages (e.g. chat from user)
            # Forward to Chat Service via RabbitMQ or HTTP?
            # "Forward chat messages from the Customer Support Microservice" (meaning outgoing)
            # "Support bidirectional messaging"
            # So if user types, we send to Chat Service.
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, device_id)

@app.websocket("/ws/chat/{user_id}")
async def chat_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # TODO: Publish to Chat Service Queue
            # We need a queue to send messages TO the chat service.
            pass 
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
