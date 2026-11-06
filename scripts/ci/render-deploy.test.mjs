// Tests for scripts/ci/render-deploy.sh against a tiny mock Render API.
// Run: pnpm test:scripts   (node --test scripts/ci/render-deploy.test.mjs). Needs bash, curl and jq on PATH.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'render-deploy.sh');
const API_KEY = 'rnd_test_secret_key_do_not_print';
const SHA = 'b24e77a0000000000000000000000000000000aa';
const OTHER_SHA = 'c0ffee00000000000000000000000000000000bb';
const SERVICE = 'srv-api';
const WORKER = 'srv-worker';

/** A `GET /services/:id/deploys` list entry. */
const entry = (id, status, commit, createdAt) => ({
  deploy: { id, status, commit: { id: commit }, trigger: 'api', createdAt },
  cursor: `cursor-${id}`,
});

let mock;
let baseUrl;
/** Per-test mock state, reset in afterEach. */
let state;

const resetState = () => {
  state = {
    /** Sequential POST responses; the last one repeats. { status, body? } */
    posts: [{ status: 201, body: { id: 'dep-1', status: 'created' } }],
    /** deploy id -> sequence of statuses returned by GET /deploys/:id; the last one repeats. */
    statuses: {},
    /** Sequential list responses (arrays of entries); the last one repeats. */
    lists: [[]],
    requests: [],
  };
};

const next = (queue) => (queue.length > 1 ? queue.shift() : queue[0]);

before(async () => {
  resetState();
  mock = createServer((req, res) => {
    const url = new URL(req.url, 'http://mock');
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      state.requests.push({
        method: req.method,
        path: url.pathname,
        auth: req.headers.authorization,
        body: raw ? JSON.parse(raw) : undefined,
      });
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(body === undefined ? '' : JSON.stringify(body));
      };
      const parts = url.pathname.split('/').filter(Boolean); // services, :id, deploys[, :deployId]
      if (parts[0] !== 'services' || parts[2] !== 'deploys') return send(404, { message: 'nope' });
      if (req.method === 'POST' && parts.length === 3) {
        const { status, body } = next(state.posts);
        return send(status, body);
      }
      if (req.method === 'GET' && parts.length === 3) return send(200, next(state.lists));
      if (req.method === 'GET' && parts.length === 4) {
        const queue = state.statuses[parts[3]];
        if (!queue) return send(404, { message: 'unknown deploy' });
        return send(200, { id: parts[3], status: next(queue), commit: { id: SHA } });
      }
      return send(404, { message: 'nope' });
    });
  });
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${mock.address().port}`;
});

after(() => new Promise((resolve) => mock.close(resolve)));
afterEach(resetState);

/** Runs the script against the mock with tiny delays; resolves { code, stdout, stderr, output }. */
async function run(extraEnv = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'render-deploy-test-'));
  const outputFile = join(dir, 'github_output');
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('bash', [SCRIPT], {
        env: {
          PATH: process.env.PATH,
          RENDER_API_KEY: API_KEY,
          RENDER_SERVICE_ID: SERVICE,
          COMMIT_SHA: SHA,
          RENDER_API_URL: baseUrl,
          GITHUB_OUTPUT: outputFile,
          POLL_INTERVAL: '1',
          POLL_TIMEOUT: '20',
          TRIGGER_RETRY_DELAY: '0',
          LOOKUP_INTERVAL: '0',
          LOOKUP_ATTEMPTS: '4',
          ...extraEnv,
        },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => {
        stdout += c;
      });
      child.stderr.on('data', (c) => {
        stderr += c;
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
    });
    const output = await readFile(outputFile, 'utf8').catch(() => '');
    return { ...result, output };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const posts = () => state.requests.filter((r) => r.method === 'POST');
const lists = () =>
  state.requests.filter((r) => r.method === 'GET' && r.path === `/services/${SERVICE}/deploys`);

describe('render-deploy.sh', () => {
  it('201 with a deploy id: waits until live and writes deploy_id', async () => {
    state.statuses['dep-1'] = ['build_in_progress', 'update_in_progress', 'live'];

    const r = await run();

    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.output.trim(), 'deploy_id=dep-1');
    assert.equal(posts().length, 1);
    assert.deepEqual(posts()[0].body, { commitId: SHA, clearCache: 'do_not_clear' });
    assert.equal(posts()[0].auth, `Bearer ${API_KEY}`);
    assert.equal(lists().length, 0, 'no list lookup when the POST returned an id');
    assert.ok(
      !r.stdout.includes(API_KEY) && !r.stderr.includes(API_KEY),
      'API key must not be logged',
    );
  });

  it('202 with an empty body: finds the queued deploy by commit and waits on it', async () => {
    state.posts = [{ status: 202 }];
    // First lookup: the queued deploy is not listed yet. Second: it is, among unrelated deploys.
    state.lists = [
      [entry('dep-old', 'live', OTHER_SHA, '2026-01-01T00:00:00Z')],
      [
        entry('dep-other', 'queued', OTHER_SHA, '2026-01-03T00:00:00Z'),
        entry('dep-queued', 'queued', SHA, '2026-01-02T00:00:00Z'),
        entry('dep-failed', 'build_failed', SHA, '2026-01-01T12:00:00Z'),
        entry('dep-old', 'live', OTHER_SHA, '2026-01-01T00:00:00Z'),
      ],
    ];
    state.statuses['dep-queued'] = ['queued', 'build_in_progress', 'live'];

    const r = await run();

    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.output.trim(), 'deploy_id=dep-queued');
    assert.equal(posts().length, 1);
    assert.equal(lists().length, 2, 'the lookup is retried until the deploy is listed');
  });

  it('202 and the deploy never shows up: fails with a clear message', async () => {
    state.posts = [{ status: 202 }];
    state.lists = [[entry('dep-old', 'live', OTHER_SHA, '2026-01-01T00:00:00Z')]];

    const r = await run({ LOOKUP_ATTEMPTS: '3' });

    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /Could not find a deploy of b24e77a\w* on srv-api after 3 attempts/);
    assert.equal(lists().length, 3);
  });

  it('retries the trigger on 503 and then succeeds on 201', async () => {
    state.posts = [
      { status: 503, body: { message: 'unavailable' } },
      { status: 429, body: { message: 'slow down' } },
      { status: 201, body: { id: 'dep-1', status: 'created' } },
    ];
    state.statuses['dep-1'] = ['live'];

    const r = await run();

    assert.equal(r.code, 0, r.stderr);
    assert.equal(posts().length, 3);
    assert.equal(r.output.trim(), 'deploy_id=dep-1');
  });

  it('gives up after TRIGGER_ATTEMPTS transient failures', async () => {
    state.posts = [{ status: 503 }];

    const r = await run({ TRIGGER_ATTEMPTS: '3' });

    assert.notEqual(r.code, 0);
    assert.equal(posts().length, 3);
  });

  it('does not retry a 4xx other than 429', async () => {
    state.posts = [{ status: 401, body: { message: 'unauthorized' } }];

    const r = await run();

    assert.notEqual(r.code, 0);
    assert.equal(posts().length, 1);
  });

  it('build_failed exits non-zero', async () => {
    state.statuses['dep-1'] = ['build_in_progress', 'build_failed'];

    const r = await run();

    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /ended with status build_failed/);
  });

  it('deactivated is success when the live deploy is the same commit', async () => {
    state.statuses['dep-1'] = ['build_in_progress', 'deactivated'];
    state.lists = [
      [
        entry('dep-2', 'live', SHA, '2026-01-02T00:00:00Z'),
        entry('dep-1', 'deactivated', SHA, '2026-01-01T00:00:00Z'),
      ],
    ];

    const r = await run();

    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stderr, /superseded by another deploy of b24e77a/);
  });

  it('deactivated fails when the live deploy is another commit', async () => {
    state.statuses['dep-1'] = ['deactivated'];
    state.lists = [
      [
        entry('dep-2', 'live', OTHER_SHA, '2026-01-02T00:00:00Z'),
        entry('dep-1', 'deactivated', SHA, '2026-01-01T00:00:00Z'),
      ],
    ];

    const r = await run();

    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /deactivated and the live deploy is not/);
  });

  it('deploys the worker service too when RENDER_WORKER_SERVICE_ID is set', async () => {
    state.statuses['dep-1'] = ['live'];

    const r = await run({ RENDER_WORKER_SERVICE_ID: WORKER });

    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(
      posts().map((p) => p.path),
      [`/services/${SERVICE}/deploys`, `/services/${WORKER}/deploys`],
    );
  });
});
