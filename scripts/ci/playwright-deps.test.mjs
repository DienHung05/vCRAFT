// Tests for scripts/ci/playwright-deps.sh (apt-outage fallback for the e2e job, vCRAFT-99h).
// Run: pnpm test:scripts. The apt and launch commands are replaced through PW_DEPS_CMD / PW_LAUNCH_CHECK_CMD.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'playwright-deps.sh');

const hasTimeout = spawnSync('sh', ['-c', 'command -v timeout']).status === 0;

const run = (deps, launch, extraEnv = {}) =>
  spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PW_DEPS_DELAY: '0',
      PW_DEPS_CMD: deps,
      PW_LAUNCH_CHECK_CMD: launch,
      ...extraEnv,
    },
  });

describe('playwright-deps.sh', () => {
  it('succeeds without the launch check when install-deps works', () => {
    const r = run('true', 'exit 1');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /installed \(attempt 1\/3\)/);
  });

  it('retries three times, then continues with a warning when Chromium still launches', () => {
    const r = run('exit 100', 'true');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /attempt 2\/3/);
    assert.match(r.stdout, /::warning::.*continuing/);
  });

  it('fails with a clear error when apt is down and Chromium cannot launch', () => {
    const r = run('exit 100', 'exit 1');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error::.*cannot launch/);
  });

  // A hung apt (DNS timeouts) must not eat the whole job: every attempt is time-limited.
  it('kills a hung install-deps attempt and falls back', {
    skip: !hasTimeout && 'needs GNU timeout',
  }, () => {
    const r = run('sleep 30', 'true', { PW_DEPS_TIMEOUT: '1', PW_DEPS_ATTEMPTS: '2' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /attempt 1\/2/);
    assert.match(r.stdout, /::warning::.*continuing/);
  });
});
