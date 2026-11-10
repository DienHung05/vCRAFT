// Tests for scripts/ci/check-no-ai-attribution.sh against throwaway git repos.
// Run: pnpm test:scripts   (node --test scripts/ci/*.test.mjs). Needs sh and git on PATH.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-no-ai-attribution.sh');
const HUMAN = { name: 'Dev Person', email: 'dev@example.com' };
const AI = { name: 'Claude', email: 'noreply@anthropic.com' };

let repo;
let counter;

const git = (args, env = {}) => {
  const r = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
};

/** Commit with separate author/committer identities (defaults to the human). */
const commit = (message, { author = HUMAN, committer = HUMAN } = {}) => {
  counter += 1;
  writeFileSync(join(repo, 'file.txt'), `change ${counter}\n`);
  git(['add', 'file.txt']);
  git(['commit', '-q', '-m', message], {
    GIT_AUTHOR_NAME: author.name,
    GIT_AUTHOR_EMAIL: author.email,
    GIT_COMMITTER_NAME: committer.name,
    GIT_COMMITTER_EMAIL: committer.email,
  });
};

const run = (...args) => spawnSync('sh', [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' });

/** Runs the guard over every commit after the base commit. */
const check = () => run('base..HEAD');

beforeEach(() => {
  counter = 0;
  repo = mkdtempSync(join(tmpdir(), 'no-ai-attr-'));
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', HUMAN.name]);
  git(['config', 'user.email', HUMAN.email]);
  git(['config', 'commit.gpgsign', 'false']);
  commit('chore: base');
  git(['tag', 'base']);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('check-no-ai-attribution.sh', () => {
  it('passes clean commits', () => {
    commit('feat: one');
    commit('fix: two\n\nPlain body.');
    const r = check();
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  it('passes an empty range', () => {
    assert.equal(run('HEAD..HEAD').status, 0);
  });

  it('fails when the author is Claude <noreply@anthropic.com>', () => {
    commit('feat: ai authored', { author: AI });
    const r = check();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /feat: ai authored/);
    assert.match(r.stderr, /amend --reset-author/);
  });

  it('fails when only the committer is anthropic', () => {
    commit('feat: ai committed', {
      committer: { name: 'Someone', email: 'NoReply@Anthropic.com' },
    });
    const r = check();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /feat: ai committed/);
  });

  it('fails on a Claude author name with a different email', () => {
    commit('feat: named', { author: { name: 'claude code', email: 'x@example.com' } });
    assert.equal(check().status, 1);
  });

  it('fails on a Co-Authored-By Claude trailer', () => {
    commit('feat: trailer\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
    const r = check();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Co-Authored-By/);
  });

  it('fails on a Claude-Session trailer', () => {
    commit('feat: session\n\nClaude-Session: https://claude.ai/code/session_abc');
    const r = check();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Claude-Session/);
  });

  it('fails on a "Generated with [Claude Code]" footer', () => {
    commit('feat: footer\n\nGenerated with [Claude Code](https://claude.com/claude-code)');
    assert.equal(check().status, 1);
  });

  it('fails on a "Generated with Claude Code" footer', () => {
    commit('feat: footer\n\nGenerated with Claude Code');
    assert.equal(check().status, 1);
  });

  it('lists only the offending commits', () => {
    commit('feat: good');
    commit('feat: bad\n\nClaude-Session: https://claude.ai/code/session_abc');
    const r = check();
    assert.equal(r.status, 1);
    assert.match(r.stdout, /feat: bad/);
    assert.doesNotMatch(r.stdout, /feat: good/);
  });

  it('passes a body that merely mentions Claude Haiku and ANTHROPIC_API_KEY', () => {
    commit('docs: llm setup\n\nUses Claude Haiku for triage; set ANTHROPIC_API_KEY in the env.');
    const r = check();
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  it('exits 2 with a usage message when no range is given', () => {
    const r = run();
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Usage/);
  });
});
