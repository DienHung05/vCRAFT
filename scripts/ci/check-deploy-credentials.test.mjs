// Tests for scripts/ci/check-deploy-credentials.sh against a tiny mock Render + Vercel API.
// Run: pnpm test:scripts   (node --test scripts/ci/*.test.mjs). Needs bash and curl on PATH.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-deploy-credentials.sh');
const RENDER_KEY = 'rnd_test_secret_key_do_not_print';
const VERCEL_TOKEN = 'vcl_test_secret_token_do_not_print';
const SERVICE = 'srv-api';
const WORKER = 'srv-worker';
const ORG = 'team_test';
const PROJECT = 'prj_test';

let mock;
let baseUrl;
/** Per-test mock state, reset in afterEach. */
let state;

const resetState = () => {
  state = {
    /** Sequential response statuses per route key; the last one repeats. */
    render: { [SERVICE]: [200], [WORKER]: [200] },
    vercel: [200],
    requests: [],
  };
};

const next = (queue) => (queue.length > 1 ? queue.shift() : queue[0]);

before(async () => {
  resetState();
  mock = createServer((req, res) => {
    const url = new URL(req.url, 'http://mock');
    state.requests.push({
      path: url.pathname,
      teamId: url.searchParams.get('teamId'),
      auth: req.headers.authorization,
    });
    const send = (status) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      // The body echoes the credentials on purpose: the script must never print response bodies.
      res.end(JSON.stringify({ message: `status ${status}`, echo: req.headers.authorization }));
    };
    const parts = url.pathname.split('/').filter(Boolean);
    if (req.method === 'GET' && parts[0] === 'render' && parts[1] === 'services') {
      const queue = state.render[parts[2]];
      return send(queue ? next(queue) : 404);
    }
    if (req.method === 'GET' && parts[0] === 'vercel' && parts[1] === 'v9') {
      return send(parts[3] === PROJECT ? next(state.vercel) : 404);
    }
    return send(404);
  });
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${mock.address().port}`;
});

after(() => new Promise((resolve) => mock.close(resolve)));
afterEach(resetState);

/** Runs the script against the mock with tiny delays; resolves { code, stdout, stderr, output }. */
function run(extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [SCRIPT], {
      env: {
        PATH: process.env.PATH,
        RENDER_API_KEY: RENDER_KEY,
        RENDER_SERVICE_ID: SERVICE,
        RENDER_WORKER_SERVICE_ID: WORKER,
        VERCEL_TOKEN,
        VERCEL_ORG_ID: ORG,
        VERCEL_PROJECT_ID: PROJECT,
        RENDER_API_URL: `${baseUrl}/render`,
        VERCEL_API_URL: `${baseUrl}/vercel`,
        CHECK_ATTEMPTS: '3',
        CHECK_RETRY_DELAY: '0',
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
      resolve({ code, stdout, stderr, output: stdout + stderr });
    });
  });
}

const hits = (prefix) => state.requests.filter((r) => r.path.startsWith(prefix));

describe('check-deploy-credentials.sh', () => {
  it('all 200: exits 0 and checks Render API, worker and Vercel with the right auth', async () => {
    const r = await run();

    assert.equal(r.code, 0, r.output);
    assert.match(r.output, /All deploy credential checks passed/);
    assert.equal(hits(`/render/services/${SERVICE}`).length, 1);
    assert.equal(hits(`/render/services/${WORKER}`).length, 1);
    assert.equal(hits(`/render/services/${SERVICE}`)[0].auth, `Bearer ${RENDER_KEY}`);
    const vercel = hits(`/vercel/v9/projects/${PROJECT}`);
    assert.equal(vercel.length, 1);
    assert.equal(vercel[0].auth, `Bearer ${VERCEL_TOKEN}`);
    assert.equal(vercel[0].teamId, ORG);
  });

  it('Render 401: fails with the Render message, and the Vercel check still runs', async () => {
    state.render[SERVICE] = [401];

    const r = await run();

    assert.equal(r.code, 1, r.output);
    assert.match(
      r.output,
      /::error::Render API key \(API service\): HTTP 401.*Regenerate the key\/token and update the secret RENDER_API_KEY in the production environment/,
    );
    assert.doesNotMatch(r.output, /::error::Vercel/);
    assert.equal(hits(`/render/services/${SERVICE}`).length, 1, '401 is not retried');
    assert.equal(hits(`/render/services/${WORKER}`).length, 1, 'the worker check still runs');
    assert.equal(hits('/vercel/').length, 1, 'the Vercel check still runs');
  });

  it('Vercel 403: fails naming the Vercel token and the secret to rotate', async () => {
    state.vercel = [403];

    const r = await run();

    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /::error::Vercel token: HTTP 403.*update the secret VERCEL_TOKEN/);
    assert.doesNotMatch(r.output, /::error::Render/);
    assert.equal(hits('/vercel/').length, 1, '403 is not retried');
  });

  it('404: tells the operator to check the id variable', async () => {
    state.render[SERVICE] = [404];

    const r = await run();

    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /::error::Render API key \(API service\): HTTP 404.*RENDER_SERVICE_ID/);
    assert.doesNotMatch(r.output, /update the secret/);
  });

  it('empty worker id: skips the worker check and still passes', async () => {
    const r = await run({ RENDER_WORKER_SERVICE_ID: '' });

    assert.equal(r.code, 0, r.output);
    assert.match(r.output, /RENDER_WORKER_SERVICE_ID not set, skipping worker check/);
    assert.equal(hits(`/render/services/${WORKER}`).length, 0);
    assert.equal(hits(`/render/services/${SERVICE}`).length, 1);
  });

  it('5xx is retried and recovers', async () => {
    state.render[SERVICE] = [503, 502, 200];

    const r = await run();

    assert.equal(r.code, 0, r.output);
    assert.equal(hits(`/render/services/${SERVICE}`).length, 3);
    assert.match(r.output, /Transient failure for Render API key \(API service\)/);
  });

  it('persistent 5xx: fails after CHECK_ATTEMPTS without blaming the credential', async () => {
    state.vercel = [500];

    const r = await run();

    assert.equal(r.code, 1, r.output);
    assert.equal(hits('/vercel/').length, 3);
    assert.match(r.output, /::error::Vercel token: HTTP 500 after 3 attempts/);
    assert.doesNotMatch(r.output, /update the secret/);
  });

  it('unreachable API: fails after retries with a network error message', async () => {
    const r = await run({ RENDER_API_URL: 'http://127.0.0.1:1', CHECK_ATTEMPTS: '2' });

    assert.equal(r.code, 1, r.output);
    assert.match(
      r.output,
      /::error::Render API key \(API service\): no HTTP response after 2 attempts/,
    );
    assert.equal(hits('/vercel/').length, 1, 'the Vercel check still runs');
  });

  it('a missing required variable fails by name and the other checks still run', async () => {
    const r = await run({ RENDER_API_KEY: '' });

    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /::error::RENDER_API_KEY is not set/);
    assert.equal(hits('/render/').length, 0);
    assert.equal(hits('/vercel/').length, 1);
  });

  it('never prints secret values, on success or failure', async () => {
    for (const setup of [
      () => {},
      () => {
        state.render[SERVICE] = [401];
        state.vercel = [403];
      },
      () => {
        state.render[SERVICE] = [500];
      },
    ]) {
      resetState();
      setup();
      const r = await run();
      assert.ok(!r.output.includes(RENDER_KEY), 'Render key must not be logged');
      assert.ok(!r.output.includes(VERCEL_TOKEN), 'Vercel token must not be logged');
    }
  });
});
