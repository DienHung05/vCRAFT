import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

// Read-only diagnostic fixture. Never use this server as an application data cache.
const port = Number(process.env.PERF_FIXTURE_PORT ?? 4018);
const latencyMs = Number(process.env.PERF_FIXTURE_LATENCY_MS ?? 200);
const upstream = 'https://vcraft-api.onrender.com/api/v1';
const householdPath = '/households/gom-bich-hop';
const response = await fetch(`${upstream}${householdPath}`);
if (!response.ok) throw new Error(`Cannot record public household: ${response.status}`);
const household = await response.json();
// Preserve the recorded workshop addresses; older deployments omit the optional area assignment.
const workshops = (items) => items?.map((item) => ({ areaCode: null, ...item })) ?? [];
const householdReplay = (value) => ({
  ratingAverage: null,
  ratingCount: 0,
  ...value,
  workshops: workshops(value.workshops),
  visit: {
    ...value.visit,
    showrooms: workshops(value.visit?.showrooms),
    productionWorkshops: workshops(value.visit?.productionWorkshops),
  },
});
const snapshot = JSON.stringify(householdReplay(household));
const recorded = new Map();
let calls = 0;
let suspended = false;
const server = createServer(async (request, reply) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (pathname === '/__metrics') {
    reply.setHeader('content-type', 'application/json');
    reply.end(JSON.stringify({ calls, latencyMs, suspended }));
    return;
  }
  if (pathname === '/__reset' && request.method === 'POST') {
    calls = 0;
    suspended = false;
    reply.end('reset');
    return;
  }
  if (pathname === '/__suspend' && request.method === 'POST') {
    suspended = true;
    reply.end('suspended');
    return;
  }
  if (request.method !== 'GET') {
    reply.writeHead(405).end();
    return;
  }
  if (pathname === `/api/v1${householdPath}`) {
    calls++;
    await delay(latencyMs);
    reply.setHeader('content-type', 'application/json');
    reply.writeHead(suspended ? 404 : 200);
    reply.end(suspended ? JSON.stringify({ message: 'Not found' }) : snapshot);
    return;
  }
  // Freeze only public catalog responses. Do not forward cookies or authorization.
  const publicPath = pathname.replace(/^\/api\/v1/, '');
  if (/^\/(products|households|trace|redirects|village|news|map)(\/|\?|$)/.test(publicPath)) {
    const query = new URL(request.url, `http://127.0.0.1:${port}`).search;
    const key = `${publicPath}${query}`;
    if (!recorded.has(key)) {
      const upstreamResponse = await fetch(`${upstream}${key}`);
      const body = await upstreamResponse.json();
      // The deployed API can lag the local contract. Keep its recorded content and supply only
      // empty metadata for fields that did not exist in that version. Diagnostic replay only.
      if (publicPath === '/households' && Array.isArray(body.data)) {
        body.data = body.data.map((item) => ({ ratingAverage: null, ratingCount: 0, ...item }));
      }
      if (publicPath.startsWith('/households/') && body.slug) {
        Object.assign(body, householdReplay(body));
      }
      if (publicPath.startsWith('/news')) {
        const summary = (item) => ({
          sourceName: null,
          sourceUrl: null,
          sourcePublishedAt: null,
          ...item,
        });
        if (Array.isArray(body.data)) body.data = body.data.map(summary);
        else if (body.slug) Object.assign(body, summary(body));
        if (Array.isArray(body.related)) body.related = body.related.map(summary);
      }
      recorded.set(key, { status: upstreamResponse.status, body: JSON.stringify(body) });
    }
    await delay(latencyMs);
    const value = recorded.get(key);
    reply.setHeader('content-type', 'application/json');
    reply.writeHead(value.status).end(value.body);
    return;
  }
  reply.writeHead(404).end();
});
server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({ fixture: `http://127.0.0.1:${port}/api/v1`, latencyMs }));
});
