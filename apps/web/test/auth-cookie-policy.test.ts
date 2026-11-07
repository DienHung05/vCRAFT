// @vitest-environment node
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SetAll = (
  list: { name: string; value: string; options?: Record<string, unknown> }[],
  headers?: Record<string, string>,
) => void;

let captured: { cookies: { setAll: SetAll } } | undefined;
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: typeof captured) => {
    captured = options;
    return {
      auth: {
        getClaims: async () =>
          options?.cookies.setAll([
            {
              name: 'sb-ref-auth-token',
              value: 'tok',
              options: { path: '/', sameSite: 'lax', maxAge: 34_560_000 },
            },
            { name: 'sb-ref-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
          ]),
      },
    };
  },
}));

vi.mock('@/lib/auth/supabase-config', () => ({
  supabaseConfig: () => ({ url: 'https://x.supabase.co', publishableKey: 'pk' }),
}));

const stored = new Map<string, { value: string; options: Record<string, unknown> | undefined }>();
let incoming: { name: string; value: string }[] = [];
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => incoming,
    set: (name: string, value: string, options?: Record<string, unknown>) =>
      stored.set(name, { value, options }),
  }),
}));

const { refreshSession } = await import('@/lib/auth/proxy-session');
const { createServerSupabase } = await import('@/lib/auth/supabase-server');

beforeEach(() => {
  captured = undefined;
  stored.clear();
  incoming = [];
});

function setCookieHeader(header: string, name: string): string {
  return (
    header
      .split(/,(?=\s*[\w.-]+=)/)
      .find((part) => part.trim().startsWith(`${name}=`))
      ?.trim() ?? ''
  );
}

async function refreshed(cookie: string) {
  const request = new NextRequest('http://localhost:3000/', { headers: { cookie } });
  const session = await refreshSession(request);
  const response = session.apply(NextResponse.next());
  return response.headers.get('set-cookie') ?? '';
}

describe('refreshSession cookie policy', () => {
  it('keeps the refreshed auth cookie persistent by default', async () => {
    const header = await refreshed('sb-ref-auth-token=old');
    expect(setCookieHeader(header, 'sb-ref-auth-token')).toMatch(/Max-Age=34560000/i);
  });

  it('writes a session cookie when the marker says not to remember, yet still deletes', async () => {
    const header = await refreshed('sb-ref-auth-token=old; vcraft-remember=0');
    const token = setCookieHeader(header, 'sb-ref-auth-token');
    expect(token).toContain('sb-ref-auth-token=tok');
    expect(token).not.toMatch(/Max-Age|Expires/i);
    expect(setCookieHeader(header, 'sb-ref-auth-token.1')).toMatch(/Max-Age=0/i);
  });
});

describe('createServerSupabase cookie policy', () => {
  it('keeps maxAge when remembered', async () => {
    await createServerSupabase();
    captured?.cookies.setAll([
      { name: 'sb-ref-auth-token', value: 'tok', options: { maxAge: 34_560_000 } },
    ]);
    expect(stored.get('sb-ref-auth-token')?.options).toEqual({ maxAge: 34_560_000 });
  });

  it('strips maxAge when the marker is 0 but keeps deletions', async () => {
    incoming = [{ name: 'vcraft-remember', value: '0' }];
    await createServerSupabase();
    captured?.cookies.setAll([
      { name: 'sb-ref-auth-token', value: 'tok', options: { path: '/', maxAge: 34_560_000 } },
      { name: 'sb-ref-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
    ]);
    expect(stored.get('sb-ref-auth-token')?.options).toEqual({ path: '/' });
    expect(stored.get('sb-ref-auth-token.1')?.options).toEqual({ path: '/', maxAge: 0 });
  });
});
