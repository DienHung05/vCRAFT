import { describe, expect, it, vi } from 'vitest';
import { fetchCapped, isBlockedAddress } from '../src/processors/news-import/safe-fetch';

const publicLookup = vi.fn(async (host: string) =>
  host === 'internal.example' ? [{ address: '10.0.0.5' }] : [{ address: '93.184.216.34' }],
);

const bodyOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

const run = (fetchImpl: typeof fetch, maxBytes = 100) =>
  fetchCapped('https://feed.example/rss', {
    maxBytes,
    timeoutMs: 1000,
    fetchImpl,
    lookupImpl: publicLookup,
  });

const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe('fetchCapped', () => {
  it('returns a normal https response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(bodyOf(['hello ', 'world']), { headers: { 'content-type': 'text/xml' } }),
    ) as unknown as typeof fetch;
    const res = await run(fetchImpl);
    expect(res.text()).toBe('hello world');
    expect(res.contentType).toBe('text/xml');
    expect(res.finalUrl).toBe('https://feed.example/rss');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://feed.example/rss',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('rejects an oversized content-length before reading', async () => {
    const fetchImpl = (async () =>
      new Response('x', { headers: { 'content-length': '5000' } })) as unknown as typeof fetch;
    await expect(run(fetchImpl)).rejects.toThrow(/too large/);
  });

  it('aborts a stream that grows past the cap', async () => {
    const fetchImpl = (async () =>
      new Response(bodyOf(['x'.repeat(60), 'x'.repeat(60)]))) as unknown as typeof fetch;
    await expect(run(fetchImpl)).rejects.toThrow(/too large/);
  });

  it('rejects a redirect to http', async () => {
    const fetchImpl = (async () => redirect('http://feed.example/rss')) as unknown as typeof fetch;
    await expect(run(fetchImpl)).rejects.toThrow(/non-https/);
  });

  it('rejects a redirect to a private address', async () => {
    const literal = (async () => redirect('https://192.168.1.1/x')) as unknown as typeof fetch;
    await expect(run(literal)).rejects.toThrow(/blocked address/);
    const named = (async () => redirect('https://internal.example/x')) as unknown as typeof fetch;
    await expect(run(named)).rejects.toThrow(/blocked address/);
  });

  it('follows a safe redirect', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirect('/moved'))
      .mockResolvedValueOnce(new Response('ok')) as unknown as typeof fetch;
    const res = await run(fetchImpl);
    expect(res.finalUrl).toBe('https://feed.example/moved');
    expect(res.text()).toBe('ok');
  });

  it('rejects too many redirects', async () => {
    const fetchImpl = (async () =>
      redirect('https://feed.example/again')) as unknown as typeof fetch;
    await expect(run(fetchImpl)).rejects.toThrow(/too many redirects/);
  });

  it('rejects a host that resolves to a private address', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      fetchCapped('https://internal.example/rss', {
        maxBytes: 10,
        timeoutMs: 1000,
        fetchImpl,
        lookupImpl: publicLookup,
      }),
    ).rejects.toThrow(/blocked address/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '0.0.0.0',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.1',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12::1',
    '::ffff:10.0.0.1',
    '::ffff:7f00:1',
  ])('blocks %s', (address) => expect(isBlockedAddress(address)).toBe(true));

  it.each(['93.184.216.34', '172.32.0.1', '100.128.0.1', '2606:2800:220:1::1'])(
    'allows %s',
    (address) => expect(isBlockedAddress(address)).toBe(false),
  );
});
