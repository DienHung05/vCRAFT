import { afterEach, describe, expect, it, vi } from 'vitest';

const afterTasks: Array<() => Promise<void>> = [];
vi.mock('next/server', () => ({
  after: (task: () => Promise<void>) => {
    afterTasks.push(task);
  },
}));

import { GET } from '@/app/q/[code]/route';

function call(headers: Record<string, string>) {
  const request = {
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
