#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production on the server" >&2
  exit 1
fi

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker image prune -f >/dev/null
