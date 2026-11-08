#!/usr/bin/env bash
# Early warning for expired or revoked deploy credentials: makes one read-only request per
# credential with the same secrets and variables deploy.yml uses, and fails when any is rejected.
# Without this, a revoked RENDER_API_KEY or VERCEL_TOKEN is only noticed when a production deploy runs.
#
# Checks (all must answer HTTP 200):
#   Render API key + API service    GET $RENDER_API_URL/services/$RENDER_SERVICE_ID
#   Render API key + worker service GET $RENDER_API_URL/services/$RENDER_WORKER_SERVICE_ID (only when set)
#   Vercel token + project          GET $VERCEL_API_URL/v9/projects/$VERCEL_PROJECT_ID?teamId=$VERCEL_ORG_ID
#
# Required env: RENDER_API_KEY, RENDER_SERVICE_ID, VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
# Optional env: RENDER_WORKER_SERVICE_ID  also check this service; empty = skip
#               RENDER_API_URL            Render API base (default https://api.render.com/v1; tests point it at a mock)
#               VERCEL_API_URL            Vercel API base (default https://api.vercel.com; tests point it at a mock)
#               CHECK_ATTEMPTS            requests per check on transient failures: curl error, 429, 5xx (default 3)
#               CHECK_RETRY_DELAY         seconds before the first retry, doubled each time (default 2)
# 401, 403 and 404 fail immediately. Every check runs even when an earlier one failed; the exit
# code is 1 if any failed. Failures are reported as GitHub `::error::` annotations. Secret values
# and response bodies are never printed.
set -euo pipefail

RENDER_API_URL="${RENDER_API_URL:-https://api.render.com/v1}"
VERCEL_API_URL="${VERCEL_API_URL:-https://api.vercel.com}"
CHECK_ATTEMPTS="${CHECK_ATTEMPTS:-3}"
CHECK_RETRY_DELAY="${CHECK_RETRY_DELAY:-2}"

failures=0

# fail MESSAGE: prints a GitHub error annotation and counts the failure.
fail() {
  printf '::error::%s\n' "$*"
  failures=$((failures + 1))
}

# require NAME...: fails (without printing values) when a required variable is empty or unset.
require() {
  local name missing=0
  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      fail "${name} is not set: add it to the production environment (see docs/operations/deploy.md section 12)"
      missing=1
    fi
  done
  return "$missing"
}

# http_status URL TOKEN: prints the HTTP status code, or 000 when curl itself failed.
http_status() {
  local url="$1" token="$2" code
  code=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${token}" -H "Accept: application/json" "$url" 2>/dev/null) || code="000"
  printf '%s' "$code"
}

# check LABEL SECRET_NAME ID_NAME URL TOKEN: expects HTTP 200 from URL.
# LABEL names the credential in messages; SECRET_NAME and ID_NAME are the names (not values) to fix.
check() {
  local label="$1" secret_name="$2" id_name="$3" url="$4" token="$5"
  local attempt=1 delay="$CHECK_RETRY_DELAY" code
  while true; do
    code=$(http_status "$url" "$token")
    case "$code" in
      200)
        printf 'OK: %s (HTTP 200)\n' "$label"
        return 0
        ;;
      401 | 403)
        fail "${label}: HTTP ${code}, the credential was rejected. Regenerate the key/token and update the secret ${secret_name} in the production environment (gh secret set ${secret_name} --env production)."
        return 1
        ;;
      404)
        fail "${label}: HTTP 404, not found. Check the service/project id variable ${id_name} (and that the credential's account can see it)."
        return 1
        ;;
    esac
    # Anything else (curl error, 429, 5xx, unexpected status) is retried a few times.
    if [ "$attempt" -ge "$CHECK_ATTEMPTS" ]; then
      if [ "$code" = "000" ]; then
        fail "${label}: no HTTP response after ${CHECK_ATTEMPTS} attempts (network error). Re-run the workflow; if it persists check the provider's status page."
      else
        fail "${label}: HTTP ${code} after ${CHECK_ATTEMPTS} attempts. Re-run the workflow; if it persists check the provider's status page."
      fi
      return 1
    fi
    printf 'Transient failure for %s (HTTP %s, attempt %s/%s), retrying in %ss\n' \
      "$label" "$code" "$attempt" "$CHECK_ATTEMPTS" "$delay"
    sleep "$delay"
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

if require RENDER_API_KEY RENDER_SERVICE_ID; then
  check "Render API key (API service)" RENDER_API_KEY RENDER_SERVICE_ID \
    "${RENDER_API_URL}/services/${RENDER_SERVICE_ID}" "$RENDER_API_KEY" || true
  if [ -n "${RENDER_WORKER_SERVICE_ID:-}" ]; then
    check "Render API key (worker service)" RENDER_API_KEY RENDER_WORKER_SERVICE_ID \
      "${RENDER_API_URL}/services/${RENDER_WORKER_SERVICE_ID}" "$RENDER_API_KEY" || true
  else
    echo "RENDER_WORKER_SERVICE_ID not set, skipping worker check"
  fi
fi

if require VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; then
  check "Vercel token" VERCEL_TOKEN VERCEL_PROJECT_ID \
    "${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}?teamId=${VERCEL_ORG_ID}" "$VERCEL_TOKEN" || true
fi

if [ "$failures" -gt 0 ]; then
  echo "${failures} deploy credential check(s) failed"
  exit 1
fi
echo "All deploy credential checks passed"
