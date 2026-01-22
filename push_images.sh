#!/bin/bash
set -e
REPO=sorynturda/ds_tema_3

docker push $REPO:ds-rp
# docker push $REPO:ds-auth-service
# docker push $REPO:ds-user-service
# docker push $REPO:ds-device-service
# docker push $REPO:ds-monitoring-service
# docker push $REPO:ds-load-balancer
# docker push $REPO:ds-websocket-service
# docker push $REPO:ds-chat-service