import asyncio
import websockets
import aiohttp
import json
import pika
import os
import uuid

# Config
WS_URL = "wss://localhost/ws/testuser/testdevice" # wss if Nginx handles SSL
API_URL = "https://localhost" # Nginx
# Note: Nginx uses self-signed cert, so we need to disable verification for tests

async def test_websocket_monitoring():
    print("Testing WebSocket Monitoring...")
    # 1. Connect WS
    # Verify SSL=False for self-signed
    ssl_context = False 
    # Use ws://localhost if strictly internal, but nginx maps 443.
    # Let's try to connect to Nginx. Node handles SSL termination.
    
    uri = "wss://localhost/ws/test_user/test_device"
    
    import ssl
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    async with websockets.connect(uri, ssl=ssl_context) as websocket:
        print("Connected to WebSocket.")
        
        # 2. Simulate Device Data
        # We publish to 'data_collection_exchange' manually
        connection = pika.BlockingConnection(pika.ConnectionParameters('localhost', 5672)) # Maps to rabbit
        channel = connection.channel()
        
        test_payload = {
            "device_id": "test_device",
            "user_id": "test_user",
            "timestamp": "2023-01-01 12:00:00",
            "measurement_value": 123.45
        }
        
        channel.basic_publish(
            exchange='data_collection_exchange',
            routing_key='device.measurement',
            body=json.dumps(test_payload)
        )
        print("Published test measurement.")
        connection.close()
        
        # 3. Wait for message on WS
        response = await websocket.recv()
        data = json.loads(response)
        
        print(f"Received WS message: {data}")
        assert data['measurement_value'] == 123.45, "Measurement mismatch"
        assert data['device_id'] == "test_device"
        print("Monitoring Test PASSED")

async def test_chat():
    print("\nTesting Chat Service...")
    
    import ssl
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    # Use a separate WS for user chat (listening on /ws/test_user_chat/some_device or generic)
    # Chat relies on WS notification too? Yes, our chat service publishes to broadcast.
    # We need to be connected to receive the reply.
    user_id = "chat_user"
    uri = f"wss://localhost/ws/{user_id}/dummy_device" # Connection to receive chat replies
    
    async with websockets.connect(uri, ssl=ssl_context) as websocket:
        print("Connected to WebSocket for Chat.")
        
        # Send Chat Message via REST Configured in Nginx /chat -> chat-service
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            payload = {
                "user_id": user_id,
                "text": "help"
            }
            async with session.post(f"{API_URL}/chat", json=payload) as resp:
                print(f"Sent chat message. Status: {resp.status}")
                assert resp.status == 200
                
        # Wait for reply on WS
        response = await websocket.recv()
        data = json.loads(response)
        print(f"Received Chat Reply: {data}")
        
        assert data['type'] == 'chat'
        assert "can ask about" in data['text']
        print("Chat Test PASSED")

async def main():
    try:
        await test_websocket_monitoring()
        await test_chat()
        print("\nALL TESTS PASSED")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(main())
