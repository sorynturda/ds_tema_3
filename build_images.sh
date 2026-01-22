#!/bin/bash
set -e
echo "Building images..."

docker build -t sorynturda/ds_tema_3/ds-rp:latest ./nginx
# docker build -t sorynturda/ds_tema_3/ds-auth-service:latest ./auth
# docker build -t sorynturda/ds_tema_3/ds-user-service:latest ./demo
# docker build -t sorynturda/ds_tema_3/ds-device-service:latest ./demo1
# docker build -t sorynturda/ds_tema_3/ds-monitoring-service:latest ./monitoring

# docker build -t sorynturda/ds_tema_3/ds-load-balancer:latest ./load_balancer
# docker build -t sorynturda/ds_tema_3/ds-websocket-service:latest ./websocket_service
# docker build -t sorynturda/ds_tema_3/ds-chat-service:latest ./chat_service

# echo "Images built successfully."
