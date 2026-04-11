#!/bin/sh
# Healthcheck script for Claude Usage Hub server.
# Usage: ./scripts/healthcheck.sh [server-url]
# Default server URL: http://localhost:8080

set -e

SERVER_URL="${1:-http://localhost:8080}"

response=$(curl -sf "$SERVER_URL/api/v1/health" 2>&1) || {
  echo "FAIL: server at $SERVER_URL is not reachable"
  exit 1
}

status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$status" = "ok" ]; then
  echo "OK: $SERVER_URL"
  echo "$response"
  exit 0
else
  echo "FAIL: unexpected response"
  echo "$response"
  exit 1
fi
