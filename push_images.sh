#!/bin/bash
set -e
REPO=sorynturda/ds_tema_3

docker push  ds-rp:latest
docker push  ds-auth-service:latest
docker push  ds-user-service:latest
docker push  ds-device-service:latest
docker push  ds-monitoring-service:latest

docker push  ds-load-balancer:latest
docker push  ds-websocket-service:latest
docker push  ds-chat-service:latest

