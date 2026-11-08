// @vitest-environment node
import type { MeDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ token: 'session-token' as string | null }));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabase: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: session.token ? { access_token: session.token } : null },
      }),
    },
  }),
}));

const { getViewer, getViewerState, ViewerUnavailableError } = await import('@/lib/auth/viewer');

const me: MeDto = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'ban@vidu.vn',
  fullName: null,
  username: 'pottery.buyer',
  role: 'BUYER',
  status: 'ACTIVE',
  emailVerified: true,
  mfaRequired: false,
  household: null,
};

const challenge = (status: number) =>
  new Response('<html><title>Just a moment...</title></html>', {
    status,
    headers: { 'content-type': 'text/html', 'retry-after': '0' },
  });
const problem = (status: number, code: string) =>
  Response.json({ type: 'about:blank', title: code, status, code }, { status });

let answers: Array<Response | Error>;
const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => {
  const next = answers.shift();
  if (!next) throw new Error('unexpected extra call');
  if (next instanceof Error) throw next;
  return next;
});

beforeEach(() => {
  session.token = 'session-token';
  answers = [];
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_INTERNAL_URL', 'http://api.test/api/v1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getViewerState', () => {
  it('signed in: returns the viewer after one request to the internal API', async () => {
    answers = [Response.json(me)];
    expect(await getViewerState()).toEqual({ status: 'signed-in', viewer: me });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/me');
  });

  it('no session cookie: guest without asking the API', async () => {
    session.token = null;
    expect(await getViewerState()).toEqual({ status: 'guest' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401: guest, not retried', async () => {
    answers = [problem(401, 'AUTH_UNAUTHENTICATED')];
    expect(await getViewerState()).toEqual({ status: 'guest' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429 HTML challenge then success: the retry recovers', async () => {
    answers = [challenge(429), Response.json(me)];
    expect(await getViewerState()).toEqual({ status: 'signed-in', viewer: me });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('429 HTML challenge twice: unavailable after one retry', async () => {
    answers = [challenge(429), challenge(429)];
    expect(await getViewerState()).toEqual({ status: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('503 twice: unavailable', async () => {
    answers = [problem(503, 'SERVICE_UNAVAILABLE'), problem(503, 'SERVICE_UNAVAILABLE')];
    expect(await getViewerState()).toEqual({ status: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('timeout twice: unavailable', async () => {
    const timeout = () => new DOMException('The operation timed out', 'TimeoutError');
    answers = [timeout(), timeout()];
    expect(await getViewerState()).toEqual({ status: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('network error twice: unavailable', async () => {
    answers = [new TypeError('fetch failed'), new TypeError('fetch failed')];
    expect(await getViewerState()).toEqual({ status: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a timeout then a 401: the retry result decides, so a guest', async () => {
    answers = [new DOMException('timed out', 'TimeoutError'), problem(401, 'AUTH_UNAUTHENTICATED')];
    expect(await getViewerState()).toEqual({ status: 'guest' });
  });
});

describe('getViewer', () => {
  it('still throws ViewerUnavailableError for callers that cannot show a retry state', async () => {
    answers = [challenge(503), challenge(503)];
    await expect(getViewer()).rejects.toBeInstanceOf(ViewerUnavailableError);
  });

  it('returns null for a guest and the viewer when signed in', async () => {
    session.token = null;
    expect(await getViewer()).toBeNull();
    session.token = 'session-token';
    answers = [Response.json(me)];
    expect(await getViewer()).toEqual(me);
  });
});
