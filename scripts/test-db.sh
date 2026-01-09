#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env.test" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.test"
  set +a
else
  echo "Missing .env.test (expected at $ROOT_DIR/.env.test)" >&2
  exit 1
fi

TEST_DB_CONTAINER_NAME="${TEST_DB_CONTAINER_NAME:-fiskai-test-db}"
TEST_DB_PORT="${TEST_DB_PORT:-5435}"
POSTGRES_USER="${POSTGRES_USER:-fiskai}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-fiskai_test_password}"
POSTGRES_DB="${POSTGRES_DB:-fiskai_test}"

cleanup() {
  if [[ "${KEEP_TEST_DB:-0}" != "1" ]]; then
    docker rm -f "$TEST_DB_CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

docker rm -f "$TEST_DB_CONTAINER_NAME" >/dev/null 2>&1 || true

docker run -d --name "$TEST_DB_CONTAINER_NAME" \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -p "$TEST_DB_PORT:5432" \
  postgres:16-alpine >/dev/null

echo "[test-db] Waiting for Postgres to be ready on localhost:${TEST_DB_PORT}..."
until docker exec "$TEST_DB_CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 0.25
done

echo "[test-db] Applying Prisma migrations (core)..."
npm run prisma:migrate

echo "[test-db] Syncing regulatory schema (no migrations yet)..."
npm run prisma:push:regulatory

echo "[test-db] Running DB tests..."
npm run test:db

