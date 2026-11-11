import { afterEach, describe, expect, it, vi } from 'vitest';

const afterTasks: Array<() => Promise<void>> = [];
vi.mock('next/server', () => ({
  after: (task: () => Promise<void>) => {
    afterTasks.push(task);
  },
}));

import { GET } from '@/app/q/[code]/route';

function call(headers: Record<string, string>, method = 'GET') {
  const request = {
    method,
    headers: new Headers(headers),
    cookies: { get: () => undefined },
  };
  return GET(request as never, { params: Promise.resolve({ code: 'ABC12345' }) } as never);
}

async function scanHeaders(headers: Record<string, string>) {
  const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchSpy);
  const response = await call(headers);
  for (const task of afterTasks.splice(0)) await task();
  expect(response.status).toBe(308);
  const calls = fetchSpy.mock.calls as unknown as Array<[string, RequestInit]>;
  return calls[0]?.[1].headers as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('/q/[code] scan forwarding (GH#362)', () => {
  it('forwards the first X-Forwarded-For hop, the User-Agent and the shared secret', async () => {
    vi.stubEnv('INTERNAL_API_KEY', 'shared');
    const sent = await scanHeaders({
      'x-forwarded-for': '203.0.113.9, 10.0.0.1',
      'user-agent': 'Visitor/1',
    });
    expect(sent['x-internal-key']).toBe('shared');
    expect(sent['x-visitor-ip']).toBe('203.0.113.9');
    expect(sent['x-visitor-ua']).toBe('Visitor/1');
  });

  it('forwards the visitor without a key when the secret is not configured', async () => {
    vi.stubEnv('INTERNAL_API_KEY', '');
    const sent = await scanHeaders({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Visitor/1' });
    expect(sent).toEqual({
      'content-type': 'application/json',
      'x-visitor-ip': '203.0.113.9',
      'x-visitor-ua': 'Visitor/1',
    });
  });
});

describe('/q/[code] redirect caching (GH#432)', () => {
  it('is never cached by the browser, so every repeat scan reaches the route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    const response = await call({ 'user-agent': 'Visitor/1' });
    afterTasks.splice(0);
    expect(response.status).toBe(308);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Vary')).toBe('Accept-Language, Cookie');
  });
});

describe('/q/[code] automated and prefetch requests (GH#483)', () => {
  const run = async (headers: Record<string, string>, method = 'GET') => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchSpy);
    const response = await call(headers, method);
    for (const task of afterTasks.splice(0)) await task();
    return { response, fetchSpy };
  };

  it.each([
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    [
      'facebookexternalhit',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    ],
    ['Slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
    ['WhatsApp', 'WhatsApp/2.23.20.0 A'],
  ])('redirects %s but reports no scan', async (_name, userAgent) => {
    const { response, fetchSpy } = await run({ 'user-agent': userAgent });
    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/vi/truy-xuat/ABC12345');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['Purpose', { purpose: 'prefetch' }, 'GET'],
    ['Sec-Purpose prefetch', { 'sec-purpose': 'prefetch' }, 'GET'],
    ['Sec-Purpose prerender', { 'sec-purpose': 'prerender' }, 'GET'],
    ['Next-Router-Prefetch', { 'next-router-prefetch': '1' }, 'GET'],
    ['X-Moz', { 'x-moz': 'prefetch' }, 'GET'],
    ['HEAD', {}, 'HEAD'],
  ])('redirects a %s request but reports no scan', async (_name, extra, method) => {
    const { response, fetchSpy } = await run({ 'user-agent': 'Visitor/1', ...extra }, method);
    expect(response.status).toBe(308);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still reports a phone scan', async () => {
    const { response, fetchSpy } = await run({
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Mobile/15E148',
    });
    expect(response.status).toBe(308);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
