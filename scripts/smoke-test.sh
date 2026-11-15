#!/usr/bin/env bash
# CI smoke test — runs against the test environment started by docker-compose.test.yaml.
#
# Tests:
#   1. Backend health endpoint responds with { "status": "ok" }
#   2. The local user is served (proves: DB connected, migrations ran, local user bootstrapped)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
MAX_WAIT=120   # seconds total to wait for backend to be ready
INTERVAL=5

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; exit 1; }

# ── 1. Wait for health ────────────────────────────────────────────────────────

echo "Waiting for backend at $BASE_URL (up to ${MAX_WAIT}s)..."
elapsed=0
until curl -sf "$BASE_URL/api/health" > /dev/null 2>&1; do
  elapsed=$((elapsed + INTERVAL))
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    fail "Backend did not become healthy within ${MAX_WAIT}s"
  fi
  echo "  ${elapsed}s elapsed — retrying in ${INTERVAL}s..."
  sleep "$INTERVAL"
done

# ── 2. Assert health response body ───────────────────────────────────────────

HEALTH=$(curl -sf "$BASE_URL/api/health")
echo "  Health response: $HEALTH"
if ! echo "$HEALTH" | grep -q '"status":"ok"'; then
  fail "Unexpected health response: $HEALTH"
fi
pass "/api/health → {\"status\":\"ok\"}"

# ── 3. Local user (created on first startup — there is no login) ─────────────

ME=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/me")
HTTP_STATUS=$(echo "$ME" | tail -n1)

if [ "$HTTP_STATUS" != "200" ]; then
  fail "GET /api/me returned HTTP $HTTP_STATUS (expected 200)"
fi
if ! echo "$ME" | grep -q '"role":"senior"'; then
  fail "GET /api/me did not return the local user: $ME"
fi
pass "GET /api/me → HTTP 200 (local user)"

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "All smoke tests passed."
