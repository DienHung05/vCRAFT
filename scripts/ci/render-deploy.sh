#!/usr/bin/env bash
# Trigger a Render deploy of one commit and wait until it is live (or fails).
#
# Required env: RENDER_API_KEY, RENDER_SERVICE_ID, COMMIT_SHA
# Optional env: RENDER_WORKER_SERVICE_ID  deploy this service too (same SHA) after the API is live
#               RENDER_API_URL            API base (default https://api.render.com/v1; tests point it at a mock)
#               POLL_INTERVAL             seconds between polls (default 15)
#               POLL_TIMEOUT              seconds before giving up (default 1500 = 25 min)
# Writes deploy_id=<id> to $GITHUB_OUTPUT when set. All logging goes to stderr so that
# functions can return values on stdout. The API key is never printed.
set -euo pipefail

: "${RENDER_API_KEY:?RENDER_API_KEY is required}"
: "${RENDER_SERVICE_ID:?RENDER_SERVICE_ID is required}"
: "${COMMIT_SHA:?COMMIT_SHA is required}"
RENDER_WORKER_SERVICE_ID="${RENDER_WORKER_SERVICE_ID:-}"
RENDER_API_URL="${RENDER_API_URL:-https://api.render.com/v1}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
POLL_TIMEOUT="${POLL_TIMEOUT:-1500}"

log() { printf '%s\n' "$*" >&2; }

# api METHOD PATH [JSON_BODY]: prints the response body on stdout, returns non-zero on non-2xx.
api() {
  local method="$1" path="$2" body="${3:-}" out code
  local args=(-sS --max-time 30 -X "$method" -H "Authorization: Bearer ${RENDER_API_KEY}" -H "Accept: application/json")
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  out=$(mktemp)
  code=$(curl "${args[@]}" -o "$out" -w '%{http_code}' "${RENDER_API_URL}${path}") || {
    log "curl failed for ${method} ${path}"
    rm -f "$out"
    return 1
  }
  if [[ "$code" != 2* ]]; then
    log "Render API ${method} ${path} returned HTTP ${code}"
    log "Response body: $(head -c 1000 "$out")"
    rm -f "$out"
    return 1
  fi
  cat "$out"
  rm -f "$out"
}

# deploy_service SERVICE_ID: triggers a deploy of $COMMIT_SHA, prints the deploy id on stdout.
deploy_service() {
  local service_id="$1" body response id
  body=$(jq -cn --arg c "$COMMIT_SHA" '{commitId: $c, clearCache: "do_not_clear"}')
  log "Triggering deploy of ${COMMIT_SHA} on ${service_id}"
  response=$(api POST "/services/${service_id}/deploys" "$body") || return 1
  id=$(jq -r '.id // empty' <<<"$response")
  if [ -z "$id" ]; then
    log "No deploy id in response: $(head -c 500 <<<"$response")"
    return 1
  fi
  printf '%s\n' "$id"
}

# wait_live SERVICE_ID DEPLOY_ID: polls until the deploy is live; non-zero on failure or timeout.
wait_live() {
  local service_id="$1" deploy_id="$2" elapsed=0 response status
  while [ "$elapsed" -lt "$POLL_TIMEOUT" ]; do
    if response=$(api GET "/services/${service_id}/deploys/${deploy_id}"); then
      status=$(jq -r '.status // "unknown"' <<<"$response")
      log "[${elapsed}s] ${service_id} deploy ${deploy_id}: ${status}"
      case "$status" in
        live) return 0 ;;
        build_failed | update_failed | pre_deploy_failed | canceled | deactivated)
          log "Deploy ${deploy_id} ended with status ${status}"
          log "Dashboard: https://dashboard.render.com/web/${service_id}/events"
          return 1
          ;;
      esac
    else
      log "Status request failed, will retry"
    fi
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done
  log "Timed out after ${POLL_TIMEOUT}s waiting for deploy ${deploy_id}"
  log "Dashboard: https://dashboard.render.com/web/${service_id}/events"
  return 1
}

api_deploy_id=$(deploy_service "$RENDER_SERVICE_ID")
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "deploy_id=${api_deploy_id}" >>"$GITHUB_OUTPUT"
fi
wait_live "$RENDER_SERVICE_ID" "$api_deploy_id"

if [ -n "$RENDER_WORKER_SERVICE_ID" ]; then
  worker_deploy_id=$(deploy_service "$RENDER_WORKER_SERVICE_ID")
  wait_live "$RENDER_WORKER_SERVICE_ID" "$worker_deploy_id"
else
  log "RENDER_WORKER_SERVICE_ID not set, skipping worker deploy"
fi
log "Render deploy finished: live"
