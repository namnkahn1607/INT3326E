#!/bin/sh
# Bootstrap topics and subscriptions on the Google Cloud Pub/Sub emulator

PUBSUB_PROJECT_ID="${PUBSUB_PROJECT_ID:-parcelflow-dev}"
PUBSUB_EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
TOPIC_NAME="${PUBSUB_TOPIC_GPS_EVENTS:-gps-events}"
SUB_NAME="${PUBSUB_SUB_GPS_EVENTS:-gps-events-sub}"

echo "Creating topic: ${TOPIC_NAME} under project: ${PUBSUB_PROJECT_ID}..."
curl -s -X PUT "http://${PUBSUB_EMULATOR_HOST}/v1/projects/${PUBSUB_PROJECT_ID}/topics/${TOPIC_NAME}"

echo "Creating subscription: ${SUB_NAME} on topic: ${TOPIC_NAME}..."
curl -s -X PUT "http://${PUBSUB_EMULATOR_HOST}/v1/projects/${PUBSUB_PROJECT_ID}/subscriptions/${SUB_NAME}" \
  -H "Content-Type: application/json" \
  -d "{\"topic\":\"projects/${PUBSUB_PROJECT_ID}/topics/${TOPIC_NAME}\"}"

echo "Pub/Sub bootstrap completed successfully."
