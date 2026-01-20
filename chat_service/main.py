from fastapi import FastAPI
import pika
import os
import json

import google.generativeai as genai

import time


from dotenv import load_dotenv
load_dotenv()
app = FastAPI()

# Configure Gemini
GENAI_API_KEY = os.getenv('GEMINI_API_KEY')
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

# Simple Rule-Based Chatbot
RULES = {
    # ... (Keep existing rules) ...
    "hello": "Hello! How can I help you with your energy monitoring?",
    "help": "You can ask about 'consumption', 'devices', or 'alerts'.",
    "consumption": "You can view consumption on the dashboard charts.",
    "devices": "Manage your devices in the 'Devices' tab.",
    "bill": "We do not handle billing directly, please contact your provider.",
    "error": "If you see an error, please try refreshing the page.",
    "contact": "You can reach support at support@example.com.",
    "login": "Use your email and password to log in.",
    "password": "You can reset your password on the login screen.",
    "tariff": "Tariffs are updated hourly based on market rates."
}

# In-memory session store
# Structure: { user_id: { 'messages': [ {sender, text, timestamp} ], 'last_active': float } }
sessions = {}

@app.get("/chat/sessions")
async def get_sessions():
    """Admin: Get list of active chat sessions"""
    active_sessions = []
    for uid, data in sessions.items():
        active_sessions.append({
            "user_id": uid,
            "last_message": data['messages'][-1]['text'] if data['messages'] else "",
            "last_active": data['last_active'],
            "message_count": len(data['messages']),
            "admin_requested": data.get('admin_requested', False),
            "admin_joined": data.get('admin_joined', False)
        })
    # Sort by recent activity
    active_sessions.sort(key=lambda x: x['last_active'], reverse=True)
    return active_sessions

@app.get("/chat/history/{user_id}")
async def get_history(user_id: str):
    """Admin: Get chat history for a specific user"""
    if user_id in sessions:
        return sessions[user_id]['messages']

    return []

@app.post("/chat/request-admin")
async def request_admin(payload: dict):
    user_id = payload.get('user_id')
    if not user_id:
        return {"status": "error", "message": "Missing user_id"}
    
    if user_id not in sessions:
        sessions[user_id] = {'messages': [], 'last_active': time.time()}
    
    sessions[user_id]['admin_requested'] = True
    
    # Notify via WS
    sys_msg = {
        'user_id': user_id,
        'type': 'chat',
        'text': 'An agent has been requested. Please wait.',
        'sender': 'system'
    }
    sessions[user_id]['messages'].append({
        "sender": "system",
        "text": sys_msg['text'],
        "timestamp": time.time()
    })
    publish_to_ws(sys_msg)
    
    return {"status": "ok"}

@app.post("/chat/join")
async def join_chat(payload: dict):
    user_id = payload.get('user_id') # The user the admin is joining
    if not user_id:
        return {"status": "error", "message": "Missing user_id"}
    
    if user_id in sessions:
        sessions[user_id]['admin_joined'] = True
        sessions[user_id]['admin_requested'] = False # Request fulfilled
        
        # Notify via WS
        sys_msg = {
            'user_id': user_id,
            'type': 'chat',
            'text': 'An administrator has joined the chat.',
            'sender': 'system'
        }
        sessions[user_id]['messages'].append({
            "sender": "system",
            "text": sys_msg['text'],
            "timestamp": time.time()
        })
        publish_to_ws(sys_msg)
        return {"status": "ok"}
    
    return {"status": "error", "message": "Session not found"}

@app.post("/chat/message")
async def send_message(message: dict):
    """
    Receive message from User or Admin
    """
    user_id = message.get('user_id')
    text = message.get('text', '')
    sender = message.get('sender', 'user') # 'user' or 'admin'
    
    if not user_id or not text:
        return {"status": "error", "message": "Missing user_id or text"}

    # 1. Update Session
    if user_id not in sessions:
        sessions[user_id] = {'messages': [], 'last_active': 0}
    
    msg_entry = {
        "sender": sender,
        "text": text,
        "timestamp": time.time()
    }
    sessions[user_id]['messages'].append(msg_entry)
    sessions[user_id]['last_active'] = time.time()

    # 2. Broadcast the Incoming Message (Echo)
    # This ensures both User and Admin see what was just sent
    echo_payload = {
        'user_id': user_id,
        'type': 'chat',
        'text': text,
        'sender': sender
    }
    print(f"[CHAT] Publishing echo to WS: {echo_payload}")
    publish_to_ws(echo_payload)

    # 3. AI Logic (Only if sender is 'user' AND admin has NOT joined)
    admin_joined = sessions[user_id].get('admin_joined', False)
    
    if sender == 'user' and not admin_joined:
        response_text = None
        
        # Rule matching
        text_lower = text.lower()
        for key, reply in RULES.items():
            if key in text_lower:
                response_text = reply
                break
        
        # AI Fallback
        if not response_text and GENAI_API_KEY:
            try:
                model = genai.GenerativeModel('gemini-2.0-flash-lite')
                response = model.generate_content(text)
                response_text = response.text
                print(f"Gemini Response: {response_text}")
            except Exception as e:
                print(f"Gemini API Error: {e}")
                response_text = "I'm currently unable to access my AI brain."
        
        # Fallback if no response generated (e.g. no API key and no rule match)
        if not response_text:
             response_text = "I didn't understand that. Try asking about 'help', 'consumption', or 'devices'."
        
        # If we have an automated response (Rule or AI), send it
        if response_text:
             # Add AI response to history
             ai_msg_entry = {
                 "sender": "assistant",
                 "text": response_text,
                 "timestamp": time.time()
             }
             sessions[user_id]['messages'].append(ai_msg_entry)
             
             # Broadcast AI response
             ai_payload = {
                 'user_id': user_id,
                 'type': 'chat',
                 'text': response_text,
                 'sender': 'assistant' # Distinguished from 'admin'
             }
             publish_to_ws(ai_payload)

    return {"status": "sent"}

def publish_to_ws(payload):
    RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbit')
    RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'kalo')
    RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'kalo')
    
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    params = pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=credentials)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    
    channel.exchange_declare(exchange='broadcast_exchange', exchange_type='fanout', durable=True)
    
    channel.basic_publish(
        exchange='broadcast_exchange',
        routing_key='', # Fanout ignores routing key
        body=json.dumps(payload)
    )
    print(f"[CHAT] Published to RabbitMQ: {payload}")
    connection.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
