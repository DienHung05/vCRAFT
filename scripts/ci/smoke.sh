#!/usr/bin/env bash
# Read-only smoke checks of a deployed vCraft web origin (docs/operations/deploy.md section 8).
# Usage: scripts/ci/smoke.sh https://vcraft-vn.vercel.app
# Env: SMOKE_RETRIES (default 6), SMOKE_DELAY seconds between attempts (default 10).
# Bodies and headers go to temp files, so large pages cannot break a pipe under pipefail.
set -euo pipefail

ORIGIN="${1:?Usage: $0 <origin>}"
ORIGIN="${ORIGIN%/}"
RETRIES="${SMOKE_RETRIES:-6}"
DELAY="${SMOKE_DELAY:-10}"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

failed=0

# check NAME PATH EXPECTED_STATUS HEADER_REGEX BODY_REGEX
# Empty regex = no check. Retries the whole request until everything matches.
check() {
  local name="$1" path="$2" want="$3" header_re="$4" body_re="$5"
  local attempt code reason=""
  for attempt in $(seq 1 "$RETRIES"); do
    code=$(curl -sS --max-time 20 -D "$WORK/h" -o "$WORK/b" -w '%{http_code}' "${ORIGIN}${path}" 2>"$WORK/e") || code="000"
    reason=""
    if [ "$code" != "$want" ]; then
      reason="HTTP ${code}, expected ${want} $(head -c 200 "$WORK/e")"
    elif [ -n "$header_re" ] && ! grep -Eiq "$header_re" "$WORK/h"; then
      reason="header /${header_re}/ not found"
    elif [ -n "$body_re" ] && ! grep -Eq "$body_re" "$WORK/b"; then
      reason="body /${body_re}/ not found"
    else
      echo "ok   ${name} (attempt ${attempt})"
      return 0
    fi
    [ "$attempt" -lt "$RETRIES" ] && sleep "$DELAY"
  done
  echo "FAIL ${name}: ${reason}" >&2
  failed=1
}

check "web home /vi" "/vi" 200 "" "<html"
check "API health through the rewrite" "/api/v1/health" 200 "" '"status":"ok"'
# curl does not follow redirects here, so the 308 and its Location are visible.
check "QR redirect /q/DF6P3WZE" "/q/DF6P3WZE" 308 '^location:.*/vi/truy-xuat/DF6P3WZE' ""
check "HSTS header on /vi" "/vi" 200 '^strict-transport-security:' ""

if [ "$failed" -ne 0 ]; then
  echo "Smoke checks FAILED against ${ORIGIN}" >&2
  exit 1
fi
echo "All smoke checks passed against ${ORIGIN}"
