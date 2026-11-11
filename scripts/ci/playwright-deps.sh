#!/usr/bin/env bash
# Install Playwright's Chromium system libraries on a CI runner without letting an Ubuntu apt mirror outage fail the job (vCRAFT-99h).
# Flow: retry `playwright install-deps` (apt) -> if apt stays unreachable, check that Chromium can still launch with the
# libraries already on the runner image -> warn and continue if it can, fail with a clear message if it cannot.
# Usage: scripts/ci/playwright-deps.sh
# Env (all optional, mainly for tests): PW_DEPS_ATTEMPTS (default 3), PW_DEPS_DELAY seconds between attempts (default 20),
#   PW_DEPS_CMD (default: pnpm --filter @vcraft/e2e exec playwright install-deps chromium),
#   PW_LAUNCH_CHECK_CMD (default: launch Playwright Chromium headless through the e2e package and close it).
set -euo pipefail

ATTEMPTS="${PW_DEPS_ATTEMPTS:-3}"
DELAY="${PW_DEPS_DELAY:-20}"
DEPS_CMD="${PW_DEPS_CMD:-pnpm --filter @vcraft/e2e exec playwright install-deps chromium}"
LAUNCH_SCRIPT="const { chromium } = require('@playwright/test'); (async () => { const b = await chromium.launch(); await b.close(); })().catch((e) => { console.error(e.message); process.exit(1); });"
LAUNCH_CMD="${PW_LAUNCH_CHECK_CMD:-pnpm --filter @vcraft/e2e exec node -e \"$LAUNCH_SCRIPT\"}"

for attempt in $(seq 1 "$ATTEMPTS"); do
  if bash -c "$DEPS_CMD"; then
    echo "Playwright system dependencies installed (attempt $attempt/$ATTEMPTS)."
    exit 0
  fi
  if [ "$attempt" -lt "$ATTEMPTS" ]; then
    echo "::warning::Playwright install-deps failed (attempt $attempt/$ATTEMPTS); retrying in ${DELAY}s."
    sleep "$DELAY"
  fi
done

echo "apt-based install-deps failed after $ATTEMPTS attempts; checking whether Chromium launches with the libraries already on the runner."
if bash -c "$LAUNCH_CMD"; then
  echo "::warning::Playwright install-deps failed after $ATTEMPTS attempts (Ubuntu apt mirrors unreachable?), but Chromium launches with the preinstalled libraries; continuing."
  exit 0
fi

echo "::error::Playwright system dependencies could not be installed (apt unreachable) and Chromium cannot launch with the libraries on this runner. Re-run the job once the Ubuntu mirrors recover."
exit 1
