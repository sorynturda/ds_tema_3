#!/bin/bash
set -e

echo "Building images..."

REPO=sorynturda/ds_tema_3

docker build -t $REPO:ds-rp -f ./nginx/Dockerfile .
docker build -t $REPO:ds-auth-service ./auth
docker build -t $REPO:ds-user-service ./demo
docker build -t $REPO:ds-device-service ./demo1
docker build -t $REPO:ds-monitoring-service ./monitoring
docker build -t $REPO:ds-load-balancer ./load_balancer
docker build -t $REPO:ds-websocket-service ./websocket_service
docker build -t $REPO:ds-chat-service ./chat_service

echo "Images built successfully."
