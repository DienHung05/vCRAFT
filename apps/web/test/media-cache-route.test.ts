// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/media-cache/[...path]/route';

const call = () =>
  GET(new Request('http://localhost/media-cache/a/b.img'), {
    params: Promise.resolve({ path: ['a', 'b.img'] }),
  } as never);

const upstream = (type: string | null, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('x', { status, headers: type ? { 'content-type': type } : {} })),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('media-cache route', () => {
  it('serves webp with nosniff and cache headers', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
    upstream('image/webp');
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toContain('max-age=');
  });

  it.each(['image/svg+xml', 'text/html', 'image/gif'])('rejects %s', async (type) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
    upstream(type);
    expect((await call()).status).toBe(404);
  });
});
