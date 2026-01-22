#!/bin/bash
set -e
echo "Building images..."

docker build -t ds-rp:latest ./nginx
docker build -t ds-auth-service:latest ./auth
docker build -t ds-user-service:latest ./demo
docker build -t ds-device-service:latest ./demo1
docker build -t ds-monitoring-service:latest ./monitoring

docker build -t ds-load-balancer:latest ./load_balancer
docker build -t ds-websocket-service:latest ./websocket_service
docker build -t ds-chat-service:latest ./chat_service

echo "Images built successfully."
