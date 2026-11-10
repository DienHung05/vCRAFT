// Tests for scripts/ci/check-commit-msg.sh (the lefthook commit-msg hook).
// Run: pnpm test:scripts   (node --test scripts/ci/*.test.mjs). Needs sh on PATH.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-commit-msg.sh');

let dir;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'commit-msg-'));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const check = (message) => {
  const file = join(dir, 'COMMIT_EDITMSG');
  writeFileSync(file, message);
  return spawnSync('sh', [SCRIPT, file], { encoding: 'utf8' });
};

describe('check-commit-msg.sh', () => {
  it('accepts a normal conventional message', () => {
    assert.equal(check('feat(rfq): accept bid\n\nBody text.\n').status, 0);
  });

  it('rejects a non-conventional message', () => {
    assert.equal(check('did stuff\n').status, 1);
  });

  it('rejects a Co-Authored-By Claude trailer', () => {
    const r = check('feat: x\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /ghi công AI/);
  });

  it('rejects a Claude-Session trailer', () => {
    assert.equal(
      check('feat: x\n\nClaude-Session: https://claude.ai/code/session_abc\n').status,
      1,
    );
  });

  it('rejects a Generated-with footer', () => {
    assert.equal(
      check('feat: x\n\nGenerated with [Claude Code](https://claude.com/claude-code)\n').status,
      1,
    );
  });

  it('accepts a body that only mentions Claude Haiku', () => {
    assert.equal(check('docs: x\n\nTriage uses Claude Haiku.\n').status, 0);
  });
});
