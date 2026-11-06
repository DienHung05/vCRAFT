#!/usr/bin/env bash
# Trigger a Render deploy of one commit and wait until it is live (or fails).
#
# Render's Trigger Deploy endpoint answers 201 + deploy JSON when the deploy starts right away, and
# 202 with an EMPTY body when it was accepted but queued (e.g. another deploy of the service is in
# progress). In the 202 case the deploy id is looked up from the deploys list by commit SHA.
#
# Required env: RENDER_API_KEY, RENDER_SERVICE_ID, COMMIT_SHA
# Optional env: RENDER_WORKER_SERVICE_ID  deploy this service too (same SHA) after the API is live
#               RENDER_API_URL            API base (default https://api.render.com/v1; tests point it at a mock)
#               POLL_INTERVAL             seconds between polls (default 15)
#               POLL_TIMEOUT              seconds before giving up (default 1500 = 25 min)
#               TRIGGER_ATTEMPTS          POST attempts on transient failures: curl error, 429, 5xx (default 4)
#               TRIGGER_RETRY_DELAY       seconds before the first POST retry, doubled each time (default 5)
#               LOOKUP_ATTEMPTS           tries to find a queued deploy by commit (default 12)
#               LOOKUP_INTERVAL           seconds between those tries (default 10)
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
TRIGGER_ATTEMPTS="${TRIGGER_ATTEMPTS:-4}"
TRIGGER_RETRY_DELAY="${TRIGGER_RETRY_DELAY:-5}"
LOOKUP_ATTEMPTS="${LOOKUP_ATTEMPTS:-12}"
LOOKUP_INTERVAL="${LOOKUP_INTERVAL:-10}"

# Return codes of api(): 0 = 2xx, 1 = permanent failure (3xx, 4xx other than 429), 3 = transient (curl error, 429, 5xx).
API_TRANSIENT=3

log() { printf '%s\n' "$*" >&2; }

# api METHOD PATH [JSON_BODY]: prints the response body on stdout (may be empty, e.g. HTTP 202).
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
    return "$API_TRANSIENT"
  }
  if [[ "$code" != 2* ]]; then
    log "Render API ${method} ${path} returned HTTP ${code}"
    log "Response body: $(head -c 1000 "$out")"
    rm -f "$out"
    if [ "$code" = "429" ] || [[ "$code" == 5* ]]; then
      return "$API_TRANSIENT"
    fi
    return 1
  fi
  cat "$out"
  rm -f "$out"
}

# list_deploys SERVICE_ID: prints a flat JSON array of deploy objects, newest first.
list_deploys() {
  local response
  response=$(api GET "/services/$1/deploys?limit=20") || return 1
  # Do not rely on the API's ordering: sort by createdAt (ISO-8601, so it sorts as text).
  jq -c '[.[].deploy] | sort_by(.createdAt // "") | reverse' <<<"$response"
}

# find_deploy SERVICE_ID: prints the id of the deploy of $COMMIT_SHA, retrying while it is not listed yet.
# Prefers a deploy that is still in progress, then a live one; finished/failed deploys are ignored.
find_deploy() {
  local service_id="$1" attempt deploys id
  for ((attempt = 1; attempt <= LOOKUP_ATTEMPTS; attempt++)); do
    if deploys=$(list_deploys "$service_id"); then
      id=$(jq -r --arg c "$COMMIT_SHA" '
        def same: (.commit.id // "") as $i | $i != "" and ($i == $c or ($i | startswith($c)) or ($c | startswith($i)));
        [.[] | select(same)] as $m
        | ([$m[] | select(.status | IN("created", "queued", "build_in_progress", "update_in_progress", "pre_deploy_in_progress"))]
           + [$m[] | select(.status == "live")])
        | (.[0].id // empty)' <<<"$deploys" 2>/dev/null) || id=""
      if [ -n "$id" ]; then
        printf '%s\n' "$id"
        return 0
      fi
    fi
    log "No deploy of ${COMMIT_SHA} listed yet on ${service_id} (attempt ${attempt}/${LOOKUP_ATTEMPTS})"
    if [ "$attempt" -lt "$LOOKUP_ATTEMPTS" ]; then
      sleep "$LOOKUP_INTERVAL"
    fi
  done
  log "Could not find a deploy of ${COMMIT_SHA} on ${service_id} after ${LOOKUP_ATTEMPTS} attempts"
  log "Dashboard: https://dashboard.render.com/web/${service_id}/events"
  return 1
}

# deploy_service SERVICE_ID: triggers a deploy of $COMMIT_SHA, prints the deploy id on stdout.
deploy_service() {
  local service_id="$1" body response id rc attempt=1 delay="$TRIGGER_RETRY_DELAY"
  body=$(jq -cn --arg c "$COMMIT_SHA" '{commitId: $c, clearCache: "do_not_clear"}')
  log "Triggering deploy of ${COMMIT_SHA} on ${service_id}"
  while true; do
    rc=0
    response=$(api POST "/services/${service_id}/deploys" "$body") || rc=$?
    if [ "$rc" -eq 0 ]; then
      break
    fi
    if [ "$rc" -ne "$API_TRANSIENT" ] || [ "$attempt" -ge "$TRIGGER_ATTEMPTS" ]; then
      log "Trigger failed (attempt ${attempt}/${TRIGGER_ATTEMPTS})"
      return 1
    fi
    log "Transient trigger failure (attempt ${attempt}/${TRIGGER_ATTEMPTS}), retrying in ${delay}s"
    sleep "$delay"
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
  id=$(jq -r '.id // empty' <<<"$response" 2>/dev/null) || id=""
  if [ -z "$id" ]; then
    log "Deploy accepted without a deploy id (HTTP 2xx, queued); looking it up by commit"
    find_deploy "$service_id" || return 1
    return 0
  fi
  printf '%s\n' "$id"
}

# superseded_by_same_commit SERVICE_ID: true when the service's newest live deploy is of $COMMIT_SHA.
# A commit deployed twice ends up with the older deploy `deactivated` once the newer one is live.
superseded_by_same_commit() {
  local service_id="$1" deploys live_commit
  deploys=$(list_deploys "$service_id") || return 1
  live_commit=$(jq -r '[.[] | select(.status == "live")][0].commit.id // empty' <<<"$deploys" 2>/dev/null) || return 1
  [ -n "$live_commit" ] || return 1
  [ "$live_commit" = "$COMMIT_SHA" ] || [[ "$live_commit" == "$COMMIT_SHA"* ]] || [[ "$COMMIT_SHA" == "$live_commit"* ]]
}

# wait_live SERVICE_ID DEPLOY_ID: polls until the deploy is live; non-zero on failure or timeout.
wait_live() {
  local service_id="$1" deploy_id="$2" elapsed=0 response status
  while [ "$elapsed" -lt "$POLL_TIMEOUT" ]; do
    if response=$(api GET "/services/${service_id}/deploys/${deploy_id}"); then
      status=$(jq -r '.status // "unknown"' <<<"$response" 2>/dev/null) || status="unknown"
      log "[${elapsed}s] ${service_id} deploy ${deploy_id}: ${status}"
      case "$status" in
        live) return 0 ;;
        deactivated)
          if superseded_by_same_commit "$service_id"; then
            log "Deploy ${deploy_id} was superseded by another deploy of ${COMMIT_SHA}, which is live"
            return 0
          fi
          log "Deploy ${deploy_id} was deactivated and the live deploy is not ${COMMIT_SHA}"
          log "Dashboard: https://dashboard.render.com/web/${service_id}/events"
          return 1
          ;;
        build_failed | update_failed | pre_deploy_failed | canceled)
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
